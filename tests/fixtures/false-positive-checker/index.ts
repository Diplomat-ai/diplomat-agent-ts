// Pure computation — no side effects, no tool calls
export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}

export function formatCurrency(amount: number, currency: string): string {
  return `${currency.toUpperCase()} ${(amount / 100).toFixed(2)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
