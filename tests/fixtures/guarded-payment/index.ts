import Stripe from "stripe";
import { z } from "zod";
import pRetry from "p-retry";

const stripe = new Stripe(process.env.STRIPE_KEY!);

const ChargeSchema = z.object({
  customerId: z.string().min(1),
  amount: z.number().int().min(50).max(100_000),
});

export async function chargeCustomer(
  input: unknown,
  idempotencyKey: string
) {
  // checked:ok — validated by Zod schema, retry-bounded, idempotency key required
  const { customerId, amount } = ChargeSchema.parse(input);

  return pRetry(
    () =>
      stripe.charges.create(
        { amount, currency: "usd", customer: customerId },
        { idempotencyKey }
      ),
    { retries: 3 }
  );
}
