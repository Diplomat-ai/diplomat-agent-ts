import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function createRecord(data: Record<string, unknown>) {
  return prisma.record.create({ data });
}
