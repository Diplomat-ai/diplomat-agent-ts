import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function sendEmail(to: string, subject: string, body: string) {
  return sgMail.send({
    to,
    from: "noreply@example.com",
    subject,
    text: body,
  });
}
