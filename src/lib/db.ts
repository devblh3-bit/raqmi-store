import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };

function getPrismaClient(): PrismaClient {
  if (!g.prisma || (process.env.NODE_ENV !== "production" && !("systemSetting" in g.prisma))) {
    g.prisma = new PrismaClient();
  }
  return g.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const val = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof val === "function" ? val.bind(client) : val;
  },
});

if (process.env.NODE_ENV !== "production") {
  getPrismaClient();
}
