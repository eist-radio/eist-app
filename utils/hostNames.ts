// utils/hostNames.ts

/** "A", "A & B", "A, B & C" */
export function joinHostNames(names: string[]): string {
  const clean = names.filter(Boolean);
  if (clean.length <= 1) return clean[0] ?? '';
  return `${clean.slice(0, -1).join(', ')} & ${clean[clean.length - 1]}`;
}
