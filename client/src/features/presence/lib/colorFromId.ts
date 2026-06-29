/**
 * Maps a client id to a stable HSL color. Deterministic, so every peer renders
 * the same client in the same hue without exchanging colors over the wire.
 */
export function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 70%, 45%)`;
}
