// prisma.config.ts
import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Force load the .env file from the absolute root directory path
dotenv.config({ path: resolve(process.cwd(), '.env') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("CRITICAL ARCHITECTURAL ERROR: DATABASE_URL environment variable is missing.");
}

export default defineConfig({
  datasource: {
    url: databaseUrl,
  },
});