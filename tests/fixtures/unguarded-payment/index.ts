import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_KEY!);

export async function chargeCustomer(customerId: string, amount: number) {
  const charge = await stripe.charges.create({
    amount,
    currency: "usd",
    customer: customerId,
  });
  return charge;
}
