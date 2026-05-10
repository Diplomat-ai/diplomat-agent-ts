export function runUserCode(code: string) {
  // eslint-disable-next-line no-eval
  return eval(code);
}
