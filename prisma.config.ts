// prisma.config.ts
import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("CRITICAL ARCHITECTURAL ERROR: DATABASE_URL environment variable is missing.");
}

export default defineConfig({
  datasource: {
    url: databaseUrl,
  },
  migrations: {
    // Realignment to enforce tsx compilation context inside modern ESM modules
    seed: 'npx tsx ./prisma/seed.ts',
  },
});