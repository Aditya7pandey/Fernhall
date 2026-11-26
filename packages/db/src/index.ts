import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const client = new PrismaClient({
    adapter: new PrismaPg({connectionString}),
    log:[
      {
        emit:"event",
        level:"query"
      }
    ]
  })

  if (process.env.NODE_ENV !== "production") {
    client.$on("query", (event) => {
      console.log("QUERY:", event.query);
      console.log("PARAMS:", event.params);
      console.log("DURATION:", event.duration, "ms");
    });
  }

  return client;
}

// Reuse one client across hot reloads in development
export const prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "./generated/prisma/client.js";
