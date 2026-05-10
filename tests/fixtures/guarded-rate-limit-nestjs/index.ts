import { Controller, Post, Body } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

@Controller("users")
export class UsersController {
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post()
  async createUser(@Body() body: { name: string; email: string }) {
    return prisma.user.create({ data: body });
  }
}
