import fs from "node:fs/promises";

export async function deleteUserFile(filePath: string) {
  await fs.unlink(filePath);
}
