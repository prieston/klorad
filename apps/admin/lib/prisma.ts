import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// Check if Accelerate URL is configured (starts with prisma://)
const isAccelerateUrl = (url?: string) => url?.startsWith("prisma://") ?? false;
const databaseUrl = process.env.DATABASE_URL;

// Create base Prisma client
// The withAccelerate() extension automatically reads from DATABASE_URL when it's a prisma:// URL
const prismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

// Extend with Accelerate if Accelerate URL is detected, otherwise use direct connection
export const prisma = isAccelerateUrl(databaseUrl)
  ? prismaClient.$extends(withAccelerate())
  : prismaClient;

globalForPrisma.prisma = prismaClient;

// No $disconnect() in serverless
