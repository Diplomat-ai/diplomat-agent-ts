// Read-only operations only — should produce 0 tools.
export function getName(id: string): string {
  return `user-${id}`;
}
