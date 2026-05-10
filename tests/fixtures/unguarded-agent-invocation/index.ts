import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { pull } from "langchain/hub";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Tool } from "@langchain/core/tools";

export async function runAgent(input: string) {
  const llm = new ChatOpenAI({ model: "gpt-4o" });
  const prompt = await pull<ChatPromptTemplate>("hwchase17/openai-functions-agent");
  const tools: Tool[] = [];
  const agent = await createOpenAIFunctionsAgent({ llm, tools, prompt });
  const executor = new AgentExecutor({ agent, tools });
  return executor.invoke({ input });
}
