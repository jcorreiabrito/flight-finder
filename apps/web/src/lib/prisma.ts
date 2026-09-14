import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Prisma 7 removed the bundled Rust query engine: the client connects through a
// driver adapter. PrismaPg owns a pg connection pool built from DATABASE_URL
// (the same value the CLI reads via prisma.config.ts).
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5433/flight_finder';

const adapter = new PrismaPg({ connectionString });
export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
