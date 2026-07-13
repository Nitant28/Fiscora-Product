export function normalizeVendor(
  name: string
): string {
  return name
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}
