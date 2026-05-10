import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

@Controller("orders")
export class OrderController {
  @Post()
  @UseGuards(AuthGuard("jwt"))
  async createOrder(@Body() body: { amount: number; userId: number }) {
    // auth_check guard is present via @UseGuards(AuthGuard)
    // but no input validation (no schema parse) → partial
    return prisma.order.create({
      data: { amount: body.amount, userId: body.userId },
    });
  }
}
