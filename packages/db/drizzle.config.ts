import dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';
import path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

const databaseUrl =
  process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/agent-pay-app';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
});
