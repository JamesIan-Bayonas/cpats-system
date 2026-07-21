// src/shared/prisma.ts
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Force environment initialization during independent terminal operations
dotenv.config({ path: resolve(process.cwd(), '.env') });

const host = process.env.DATABASE_HOST || '127.0.0.1';
const port = Number(process.env.DATABASE_PORT) || 3306;
const user = process.env.DATABASE_USER || 'root';
const password = process.env.DATABASE_PASSWORD || '';
const database = process.env.DATABASE_NAME || 'cpats_db';

const adapter = new PrismaMariaDb({ host, port, user, password, database });

const globalForPrisma = globalThis as unknown as    { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;