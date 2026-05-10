import Stripe from "stripe";
import nodemailer from "nodemailer";

const stripe = new Stripe(process.env.STRIPE_KEY!);
const transporter = nodemailer.createTransport({ host: "smtp.example.com" });

export async function chargeAndNotify(
  amount: number,
  currency: string,
  source: string,
  email: string
) {
  const charge = await stripe.charges.create({ amount, currency, source });
  await transporter.sendMail({
    from: "noreply@example.com",
    to: email,
    subject: "Payment received",
    text: `Charge ${charge.id} completed.`,
  });
  return charge;
}
