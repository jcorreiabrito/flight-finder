import { defineConfig } from 'prisma/config';

// Prisma 7 moved the datasource connection string out of schema.prisma (the
// `url = env(...)` line is gone) and into this config. The CLI (generate, db
// push, migrate) reads the URL from here; the runtime PrismaClient connects via
// the @prisma/adapter-pg driver adapter wired up in lib/prisma.ts instead.
//
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function getDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const envPath = resolve(process.cwd(), '.env');
  if (existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, 'utf-8');
      const match = content.match(/^DATABASE_URL=(.+)$/m);
      if (match) return match[1]!.trim().replace(/^["']|["']$/g, '');
    } catch {}
  }

  return 'postgresql://postgres:postgres@localhost:5433/flight_finder';
}

export default defineConfig({
  schema: 'apps/web/prisma/schema.prisma',
  migrations: {
    path: 'apps/web/prisma/migrations',
  },
  datasource: {
    url: getDatabaseUrl(),
  },
});
