/**
 * Tests for src/scanner/ast-scanner.ts
 *
 * Uses `scanFile()` (in-memory, no disk I/O) to verify the scanner detects
 * side effects correctly for each fixture scenario.
 */
import { describe, it, expect } from "vitest";
import path from "node:path";
import { scanFile, scan } from "../src/scanner/ast-scanner.js";

const FIXTURES = path.resolve("tests/fixtures");

describe("scanFile — unguarded-payment", () => {
  it("detects 1 tool with payment side effect and no_checks status", async () => {
    const code = `
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_KEY!);
export async function chargeCustomer(customerId: string, amount: number) {
  return stripe.charges.create({ amount, currency: "usd", customer: customerId });
}
`;
    const tools = scanFile("unguarded-payment/index.ts", code, "unguarded-payment");
    expect(tools.length).toBe(1);
    expect(tools[0]?.function).toBe("chargeCustomer");
    const cats = tools[0]?.sideEffects.map((se) => se.category);
    expect(cats).toContain("payment");
    expect(tools[0]?.status).toBe("no_checks");
  });
});

describe("scanFile — annotation-confirmed", () => {
  it("marks function as confirmed when // checked:ok annotation is present", () => {
    const code = `
import sgMail from "@sendgrid/mail";
export async function sendNotification(to: string, subject: string, body: string) {
  // checked:ok — protected by API gateway rate limiter
  await sgMail.send({ to, from: "noreply@example.com", subject, text: body });
}
`;
    const tools = scanFile("annotation-confirmed/index.ts", code, "annotation-confirmed");
    expect(tools.length).toBe(1);
    expect(tools[0]?.status).toBe("confirmed");
    expect(tools[0]?.confirmed).toMatch(/protected by API gateway/);
  });
});

describe("scanFile — readonly-only", () => {
  it("returns 0 tools for read-only operations", () => {
    const code = `
import axios from "axios";
const prisma = { user: { findUnique: async (q: unknown) => q } };
export async function listUsers() {
  return prisma.user.findUnique({ where: { id: 1 } });
}
export async function getProfile(userId: string) {
  const response = await axios.get(\`/api/users/\${userId}\`);
  return response.data;
}
`;
    const tools = scanFile("readonly-only/index.ts", code, "readonly-only");
    expect(tools.length).toBe(0);
  });
});

describe("scanFile — nested-side-effects", () => {
  it("detects both database_write and email side effects in one function", () => {
    const code = `
import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";
const prisma = new PrismaClient();
const transporter = nodemailer.createTransport({ host: "smtp.example.com" });
export async function updateAndNotify(userId: number, name: string) {
  await prisma.user.update({ where: { id: userId }, data: { name } });
  await transporter.sendMail({ from: "bot@example.com", to: "admin@example.com", subject: "Update", text: "hi" });
}
`;
    const tools = scanFile("nested-side-effects/index.ts", code, "nested-side-effects");
    expect(tools.length).toBe(1);
    const cats = tools[0]?.sideEffects.map((se) => se.category);
    expect(cats).toContain("database_write");
    expect(cats).toContain("email");
  });
});

describe("scan — multi-http fixture directory", () => {
  it("detects http_write tools from axios.post, fetch POST, and got.post", async () => {
    const tools = await scan({ path: path.join(FIXTURES, "multi-http") });
    const httpTools = tools.filter((t) =>
      t.sideEffects.some((se) => se.category === "http_write")
    );
    expect(httpTools.length).toBeGreaterThanOrEqual(1);
  });
});

describe("scan — multi-orm fixture directory", () => {
  it("detects database_write tools from all three ORM files", async () => {
    const tools = await scan({ path: path.join(FIXTURES, "multi-orm") });
    expect(tools.length).toBeGreaterThanOrEqual(1);
    const dbWriteTools = tools.filter((t) =>
      t.sideEffects.some((se) => se.category === "database_write")
    );
    expect(dbWriteTools.length).toBeGreaterThanOrEqual(1);
  });
});
