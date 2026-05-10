import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function safeCleanup(dir: string, userConfirmed: boolean) {
  if (!userConfirmed) {
    throw new Error("User confirmation required before deletion");
  }
  return execAsync(`rm -rf ${dir}`);
}
