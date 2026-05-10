import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.example.com",
  port: 587,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export async function sendWelcomeEmail(to: string) {
  return transporter.sendMail({
    from: "noreply@example.com",
    to,
    subject: "Welcome",
    text: "Welcome to our service!",
  });
}
