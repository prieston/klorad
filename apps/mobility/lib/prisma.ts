import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const isAccelerateUrl = (url?: string) => url?.startsWith("prisma://") ?? false;

const prismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

const prismaExtended = isAccelerateUrl(process.env.DATABASE_URL)
  ? prismaClient.$extends(withAccelerate())
  : prismaClient;

export const prisma = prismaExtended as unknown as PrismaClient;
globalForPrisma.prisma = prismaClient;
