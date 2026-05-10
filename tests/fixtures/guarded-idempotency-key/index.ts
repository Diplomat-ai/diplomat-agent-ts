import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_KEY!);

export async function chargeWithIdempotency(
  amount: number,
  currency: string,
  source: string,
  idempotencyKey: string
) {
  return stripe.charges.create(
    { amount, currency, source },
    { idempotencyKey }
  );
}
