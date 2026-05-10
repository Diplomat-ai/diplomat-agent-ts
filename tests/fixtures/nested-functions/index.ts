import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";

const prisma = new PrismaClient();
const transporter = nodemailer.createTransport({ host: "smtp.example.com" });

export async function processOrder(userId: string, item: string, email: string) {
  async function saveOrder() {
    return prisma.order.create({ data: { userId, item } });
  }

  async function notifyUser(orderId: string) {
    return transporter.sendMail({
      from: "noreply@example.com",
      to: email,
      subject: "Order created",
      text: `Order ${orderId} placed.`,
    });
  }

  const order = await saveOrder();
  await notifyUser(order.id);
  return order;
}
