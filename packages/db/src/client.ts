import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from './env';
import * as schema from './schema';

const pool = new Pool({
  connectionString:
    env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/agent-pay-app',
});

export const db = drizzle(pool, { schema });
export type Database = typeof db;
export default db;
