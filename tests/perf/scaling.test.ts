/**
 * Niveau 5 — Performance scaling tests.
 *
 * Verifies that the scanner completes within acceptable time bounds
 * when scanning multiple fixture directories (simulating a large codebase).
 *
 * These tests DO NOT assert on scan results — only on timing.
 */
import { describe, it, expect } from "vitest";
import path from "node:path";
import { scan } from "../../src/scanner/ast-scanner.js";

const FIXTURES = path.resolve("tests/fixtures");
const ALL_FIXTURE_DIRS = [
  "unguarded-payment-stripe",
  "unguarded-payment-paypal",
  "unguarded-database-write-prisma",
  "unguarded-database-write-mongoose",
  "unguarded-database-write-typeorm",
  "unguarded-database-write-sql",
  "unguarded-database-delete",
  "unguarded-http-fetch",
  "unguarded-http-axios",
  "unguarded-http-got",
  "unguarded-llm-openai",
  "unguarded-llm-anthropic",
  "unguarded-email-nodemailer",
  "unguarded-email-sendgrid",
  "unguarded-messaging-slack",
  "unguarded-messaging-twilio",
  "unguarded-publish-s3",
  "unguarded-dynamic-code-eval",
  "unguarded-dynamic-code-vm",
  "unguarded-file-delete-fs",
  "unguarded-file-delete-rm",
  "unguarded-destructive-exec",
  "multiple-side-effects",
  "false-positive-checker",
  "readonly-only",
];

describe("perf: scanning all fixtures individually", () => {
  it("completes in under 30 seconds total", async () => {
    const start = Date.now();

    await Promise.all(
      ALL_FIXTURE_DIRS.map((dir) =>
        scan({ path: path.join(FIXTURES, dir) }),
      ),
    );

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(30_000);
  });

  it("each individual fixture scans in under 5 seconds", async () => {
    for (const dir of ALL_FIXTURE_DIRS) {
      const start = Date.now();
      await scan({ path: path.join(FIXTURES, dir) });
      const elapsed = Date.now() - start;
      expect(elapsed, `${dir} took ${elapsed}ms`).toBeLessThan(5_000);
    }
  });
});
