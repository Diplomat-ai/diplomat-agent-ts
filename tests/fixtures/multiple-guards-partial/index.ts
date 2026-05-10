import Stripe from "stripe";
import { z } from "zod";
import { UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

const stripe = new Stripe(process.env.STRIPE_KEY!);

const PaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string(),
  source: z.string(),
});

// Auth present (method-level), but no input_validation usage and no rate-limit
export class PaymentService {
  @UseGuards(AuthGuard("jwt"))
  async chargePartial(input: { amount: number; currency: string; source: string }) {
    return stripe.charges.create(input);
  }
}
