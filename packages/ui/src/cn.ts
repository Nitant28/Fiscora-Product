/**
 * cn — tiny className combiner for the Fiscora Design System.
 * Joins truthy class fragments. Later args win by appended order, which is
 * sufficient for our controlled variant maps; swap for tailwind-merge if we
 * need conflict resolution between arbitrary utility classes.
 */
export type ClassValue =
  | string
  | number
  | null
  | false
  | undefined
  | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];

  for (const input of inputs) {
    if (!input) continue;

    if (Array.isArray(input)) {
      const nested = cn(...input);
      if (nested) out.push(nested);
    } else {
      out.push(String(input));
    }
  }

  return out.join(" ");
}
