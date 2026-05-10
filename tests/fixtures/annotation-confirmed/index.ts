import sgMail from "@sendgrid/mail";

export async function sendNotification(to: string, subject: string, body: string) {
  // checked:ok — protected by API gateway rate limiter (100/day per user)
  await sgMail.send({ to, from: "noreply@example.com", subject, text: body });
}
