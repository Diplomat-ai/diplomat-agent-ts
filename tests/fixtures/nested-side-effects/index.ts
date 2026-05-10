import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";

const prisma = new PrismaClient();
const transporter = nodemailer.createTransport({ host: "smtp.example.com" });

export async function updateAndNotify(userId: number, name: string) {
  await prisma.user.update({ where: { id: userId }, data: { name } });
  await transporter.sendMail({
    from: "bot@example.com",
    to: "admin@example.com",
    subject: "Update",
    text: `User ${userId} updated`,
  });
}
