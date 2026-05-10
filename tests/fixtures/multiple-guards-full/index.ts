import Stripe from "stripe";
import { z } from "zod";
import { UseGuards, Controller, Post, Body } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Throttle } from "@nestjs/throttler";
import pRetry from "p-retry";

const stripe = new Stripe(process.env.STRIPE_KEY!);

const PaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
  source: z.string(),
  idempotencyKey: z.string(),
});

@Controller("payments")
@UseGuards(AuthGuard("jwt"))
export class PaymentsController {
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async charge(@Body() body: unknown) {
    const { amount, currency, source, idempotencyKey } = PaymentSchema.parse(body);
    return pRetry(
      () => stripe.charges.create({ amount, currency, source }, { idempotencyKey }),
      { retries: 3 }
    );
  }
}
