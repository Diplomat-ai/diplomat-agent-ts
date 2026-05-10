import axios from "axios";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function listUsers() {
  return prisma.user.findUnique({ where: { id: 1 } });
}

export async function getProfile(userId: string) {
  const response = await axios.get(`/api/users/${userId}`);
  return response.data;
}
