import Stripe from "stripe";

// This file has a .test.ts extension and should be excluded by the scanner
const stripe = new Stripe(process.env.STRIPE_KEY!);

describe("payment", () => {
  it("charges the card", async () => {
    await stripe.charges.create({ amount: 100, currency: "usd", source: "tok_visa" });
  });
});
