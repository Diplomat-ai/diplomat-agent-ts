import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_KEY!);

export class PaymentService {
  async charge(amount: number, currency: string, source: string) {
    return stripe.charges.create({ amount, currency, source });
  }
}
