import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_KEY!);

export const charge = async (amount: number, currency: string, source: string) =>
  stripe.charges.create({ amount, currency, source });
