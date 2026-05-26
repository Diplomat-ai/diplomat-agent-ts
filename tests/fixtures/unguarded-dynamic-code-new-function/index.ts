export function runUserCode(code: string) {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function("return " + code);
  return fn();
}