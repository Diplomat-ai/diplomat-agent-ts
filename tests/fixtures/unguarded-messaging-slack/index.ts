import { WebClient } from "@slack/web-api";

const slack = new WebClient(process.env.SLACK_TOKEN);

export async function notifyChannel(channel: string, message: string) {
  return slack.chat.postMessage({
    channel,
    text: message,
  });
}
