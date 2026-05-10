import twilio from "twilio";

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

export async function sendSms(to: string, body: string) {
  return client.messages.create({
    from: process.env.TWILIO_FROM,
    to,
    body,
  });
}
