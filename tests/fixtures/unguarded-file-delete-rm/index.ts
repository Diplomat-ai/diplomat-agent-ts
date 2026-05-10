import fs from "node:fs/promises";

export async function removeDirectory(dirPath: string) {
  await fs.rm(dirPath, { recursive: true });
}
