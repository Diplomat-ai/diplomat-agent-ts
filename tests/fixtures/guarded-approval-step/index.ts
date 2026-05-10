import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function deleteUser(userId: string, confirmed: boolean) {
  if (confirmed === true) {
    return prisma.user.delete({ where: { id: userId } });
  }
  throw new Error("Deletion requires explicit confirmation");
}
