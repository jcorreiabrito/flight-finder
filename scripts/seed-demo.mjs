#!/usr/bin/env node
// Seed realistic demo data for screenshots.
// Run: node scripts/seed-demo.mjs
// Clean: node scripts/seed-demo.mjs --clean

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../apps/web/src/generated/prisma/client.ts';

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = resolve(process.cwd(), '.env');
  if (existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, 'utf-8');
      const match = content.match(/^DATABASE_URL=(.+)$/m);
      if (match) return match[1].trim().replace(/^["']|["']$/g, '');
    } catch {}
  }
  return 'postgresql://postgres:postgres@localhost:5433/flight_finder';
}

const adapter = new PrismaPg({ connectionString: getDatabaseUrl() });
const prisma = new PrismaClient({ adapter });

const ROUTES = [
  {
    rawInput: 'São Paulo para Rio de Janeiro no próximo mês',
    origin: 'CGH', originName: 'São Paulo (Congonhas)',
    destination: 'SDU', destinationName: 'Rio de Janeiro (Santos Dumont)',
    dateFrom: '2026-10-10', dateTo: '2026-10-15',
    airlines: ['LATAM', 'GOL', 'Azul'],
    basePrices: [380, 420, 450],
    currency: 'BRL',
  },
  {
    rawInput: 'São Paulo para Salvador em novembro',
    origin: 'GRU', originName: 'São Paulo (Guarulhos)',
    destination: 'SSA', destinationName: 'Salvador',
    dateFrom: '2026-11-12', dateTo: '2026-11-18',
    airlines: ['GOL', 'LATAM', 'Azul'],
    basePrices: [750, 820, 690],
    currency: 'BRL',
  },
  {
    rawInput: 'Brasília para São Paulo no final do ano',
    origin: 'BSB', originName: 'Brasília',
    destination: 'GRU', destinationName: 'São Paulo',
    dateFrom: '2026-12-20', dateTo: '2026-12-28',
    airlines: ['LATAM', 'GOL', 'Azul'],
    basePrices: [520, 580, 490],
    currency: 'BRL',
  },
  {
    rawInput: 'São Paulo para Lisboa em julho',
    origin: 'GRU', originName: 'São Paulo',
    destination: 'LIS', destinationName: 'Lisboa',
    dateFrom: '2026-07-05', dateTo: '2026-07-20',
    airlines: ['TAP Air Portugal', 'LATAM', 'Air France'],
    basePrices: [4350, 4680, 4190],
    currency: 'BRL',
  },
];

// Generate realistic price fluctuations over 14 days of scraping
function generatePrices(basePrice, scrapeCount) {
  const prices = [];
  let current = basePrice;
  for (let i = 0; i < scrapeCount; i++) {
    // Random walk with slight upward bias (airlines raise prices over time)
    const change = (Math.random() - 0.45) * basePrice * 0.06;
    current = Math.max(basePrice * 0.75, Math.min(basePrice * 1.4, current + change));
    prices.push(Math.round(current * 100) / 100);
  }
  return prices;
}

async function seed() {
  console.log('Seeding demo data...');

  const now = new Date();
  const queryIds = [];

  for (const route of ROUTES) {
    // Create query
    const query = await prisma.query.create({
      data: {
        rawInput: route.rawInput,
        origin: route.origin,
        originName: route.originName,
        destination: route.destination,
        destinationName: route.destinationName,
        dateFrom: new Date(route.dateFrom),
        dateTo: new Date(route.dateTo),
        flexibility: 3,
        cabinClass: 'economy',
        tripType: 'round_trip',
        currency: route.currency || 'BRL',
        active: true,
        isSeed: true,
        expiresAt: new Date(new Date(route.dateTo).getTime() + 3 * 86400000),
      },
    });
    queryIds.push(query.id);
    console.log(`  Created query: ${route.origin} → ${route.destination} (${query.id})`);

    // Generate 14 days of scrapes, 3x per day (every 8h)
    const scrapeCount = 42;
    const travelDates = [];
    const from = new Date(route.dateFrom);
    const to = new Date(route.dateTo);
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      travelDates.push(new Date(d));
    }

    for (let s = 0; s < scrapeCount; s++) {
      const scrapeTime = new Date(now.getTime() - (scrapeCount - s) * 8 * 3600000);

      const fetchRun = await prisma.fetchRun.create({
        data: {
          queryId: query.id,
          status: 'success',
          source: 'google_flights',
          snapshotsCount: route.airlines.length * travelDates.length,
          startedAt: scrapeTime,
          completedAt: new Date(scrapeTime.getTime() + 15000),
        },
      });

      const snapshots = [];
      for (let a = 0; a < route.airlines.length; a++) {
        const priceSeries = generatePrices(route.basePrices[a], travelDates.length);
        // Add time-based drift: prices vary per scrape run
        const runDrift = (Math.random() - 0.45) * route.basePrices[a] * 0.03;

        for (let d = 0; d < travelDates.length; d++) {
          const price = Math.max(99, priceSeries[d] + runDrift + (s * route.basePrices[a] * 0.004));
          snapshots.push({
            queryId: query.id,
            fetchRunId: fetchRun.id,
            travelDate: travelDates[d],
            price: Math.round(price * 100) / 100,
            currency: route.currency || 'BRL',
            airline: route.airlines[a],
            bookingUrl: `https://www.google.com/travel/flights?q=${route.origin}+to+${route.destination}`,
            stops: Math.random() > 0.7 ? 1 : 0,
            duration: `${7 + Math.floor(Math.random() * 6)}h ${Math.floor(Math.random() * 50) + 10}m`,
            flightId: `${route.airlines[a].replace(/\s/g, '')}-${1000 + a * 100 + d}-${route.origin}-${route.destination}`,
            status: 'available',
            scrapedAt: scrapeTime,
          });
        }
      }

      await prisma.priceSnapshot.createMany({ data: snapshots });
    }

    console.log(`  Created ${scrapeCount} scrape runs with price data`);
  }

  console.log('\nDemo queries:');
  for (const id of queryIds) {
    console.log(`  https://flight-finder.org/q/${id}`);
  }
  console.log('\nDone! Use --clean to remove seed data.');
}

async function clean() {
  console.log('Cleaning seed data...');
  const queries = await prisma.query.findMany({ where: { isSeed: true }, select: { id: true } });
  for (const q of queries) {
    await prisma.priceSnapshot.deleteMany({ where: { queryId: q.id } });
    await prisma.fetchRun.deleteMany({ where: { queryId: q.id } });
  }
  const result = await prisma.query.deleteMany({ where: { isSeed: true } });
  console.log(`Deleted ${result.count} seed queries and all their data.`);
}

try {
  if (process.argv.includes('--clean')) {
    await clean();
  } else {
    await seed();
  }
} finally {
  await prisma.$disconnect();
}
