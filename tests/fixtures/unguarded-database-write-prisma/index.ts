import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function createUser(name: string, email: string) {
  return prisma.user.create({ data: { name, email } });
}
