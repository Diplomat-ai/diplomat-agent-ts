import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// @UseGuards applied at class level should propagate to all methods
@UseGuards(AuthGuard("jwt"))
@Controller("orders")
export class OrdersController {
  @Post()
  async createOrder(@Body() body: { userId: string; item: string }) {
    return prisma.order.create({ data: body });
  }
}
