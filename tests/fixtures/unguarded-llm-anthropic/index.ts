import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function complete(prompt: string) {
  return client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });
}
