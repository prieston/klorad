/**
 * Prisma client for `apps/mock-inet`. Same singleton pattern as
 * mobility uses — cache on `globalThis` so hot-module reload doesn't
 * spawn a fresh connection on every save in dev.
 *
 * The mock only reads/writes its own `MockWebhook` table — nothing
 * else in the schema is touched from here. `DATABASE_URL` must be set
 * on the deployed environment (pointing at the same Postgres mobility
 * uses is fine and the intended setup).
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
