import Stripe from "stripe";
import { z } from "zod";

const stripe = new Stripe(process.env.STRIPE_KEY!);

const PaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
  source: z.string(),
});

export async function charge(input: unknown) {
  const { amount, currency, source } = PaymentSchema.parse(input);
  return stripe.charges.create({ amount, currency, source });
}
