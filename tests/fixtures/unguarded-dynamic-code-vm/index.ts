import vm from "node:vm";

export function runSandboxed(code: string, context: object) {
  const sandbox = { ...context };
  vm.createContext(sandbox);
  return vm.runInNewContext(code, sandbox);
}
