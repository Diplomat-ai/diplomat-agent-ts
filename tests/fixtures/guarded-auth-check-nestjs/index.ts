import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

@Controller("orders")
export class OrdersController {
  @UseGuards(AuthGuard("jwt"))
  @Post()
  async createOrder(@Body() body: { userId: string; item: string }) {
    return prisma.order.create({ data: body });
  }
}
