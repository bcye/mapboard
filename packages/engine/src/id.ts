/**
 * Random id. Uses getRandomValues rather than randomUUID, which is missing
 * outside secure contexts (e.g. testing the dev server from a phone over LAN).
 */
export function uid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("");
}
