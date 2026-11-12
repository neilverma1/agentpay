import { createEnv } from '@t3-oss/env-nextjs';
import dotenv from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

// Load .env.local and .env for CLI commands, tests, or scripts outside Next.js
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const env = createEnv({
  server: {
    DATABASE_URL: z.url().optional(),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
  },
});
