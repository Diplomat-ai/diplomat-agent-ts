// Fixture for testing detection of runEmbeddedPiAgent-style agent invocations.
// The call api.runtime.agent.runEmbeddedPiAgent() must be flagged as agent_invocation.

class Runtime {
  agent = {
    runEmbeddedPiAgent: async (input: { task: string }) => {
      return { result: "ok" };
    },
  };
}

const api = { runtime: new Runtime() };

export async function delegateToEmbedded(task: string) {
  return api.runtime.agent.runEmbeddedPiAgent({ task });
}
