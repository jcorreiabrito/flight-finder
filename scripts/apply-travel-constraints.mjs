import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

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

const databaseUrl = getDatabaseUrl();
const client = new pg.Client({ connectionString: databaseUrl });
try {
  await client.connect();
  const schema = new URL(databaseUrl).searchParams.get('schema') ?? 'public';
  await client.query("SELECT set_config('search_path', $1, false)", [`"${schema.replaceAll('"', '""')}"`]);
  const sql = await readFile(new URL('../apps/web/prisma/travel-constraints.sql', import.meta.url), 'utf8');
  await client.query(sql);
  console.log('Travel database constraints are ready');
} finally {
  await client.end();
}
