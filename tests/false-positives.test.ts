/**
 * False positive tests — verify the scanner does NOT flag read-only operations.
 */
import { describe, it, expect } from "vitest";
import { scanFile } from "../src/scanner/ast-scanner.js";

describe("false positives — read-only database operations", () => {
  it("does not flag prisma.findUnique", () => {
    const code = `
const prisma = { user: { findUnique: async (q: unknown) => q } };
export async function getUser(id: number) {
  return prisma.user.findUnique({ where: { id } });
}
`;
    const tools = scanFile("db-read.ts", code, ".");
    expect(tools).toHaveLength(0);
  });

  it("does not flag prisma.findMany", () => {
    const code = `
const prisma = { post: { findMany: async () => [] } };
export async function listPosts() {
  return prisma.post.findMany();
}
`;
    const tools = scanFile("db-read2.ts", code, ".");
    expect(tools).toHaveLength(0);
  });
});

describe("false positives — read-only HTTP operations", () => {
  it("does not flag axios.get", () => {
    const code = `
import axios from "axios";
export async function fetchData(url: string) {
  const res = await axios.get(url);
  return res.data;
}
`;
    const tools = scanFile("http-read.ts", code, ".");
    expect(tools).toHaveLength(0);
  });

  it("does not flag fetch with GET method", () => {
    const code = `
export async function getData(url: string) {
  const res = await fetch(url, { method: "GET" });
  return res.json();
}
`;
    const tools = scanFile("fetch-get.ts", code, ".");
    // GET fetch should not be flagged
    const httpWrite = tools.filter((t) =>
      t.sideEffects.some((se) => se.category === "http_write")
    );
    expect(httpWrite).toHaveLength(0);
  });
});

describe("false positives — utility functions without side effects", () => {
  it("does not flag pure computation", () => {
    const code = `
export function calculateTotal(items: number[]): number {
  return items.reduce((a, b) => a + b, 0);
}
`;
    const tools = scanFile("pure.ts", code, ".");
    expect(tools).toHaveLength(0);
  });

  it("does not flag string manipulation", () => {
    const code = `
export function formatName(first: string, last: string): string {
  return \`\${first} \${last}\`.trim();
}
`;
    const tools = scanFile("string-util.ts", code, ".");
    expect(tools).toHaveLength(0);
  });
});
