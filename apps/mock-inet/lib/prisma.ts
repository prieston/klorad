/**
 * Re-export the shared Prisma singleton so mock code can just
 * `import { prisma } from "@/lib/prisma"` — same connection pool
 * mobility uses, no duplicate client. Requires `DATABASE_URL` on
 * the mock's deploy env (same Postgres URL mobility uses).
 */
export { prisma } from "@klorad/prisma";
