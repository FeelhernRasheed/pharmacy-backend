// Applies the validated TRUST_PROXY setting to the underlying
// Express application. Kept separate from main.ts so the mapping
// from validated config to Express behaviour is unit-testable.
//
// Express expects either:
//   - a hop count (number): trust that many proxy hops, or
//   - an array of IP addresses / CIDR ranges: trust only those peers.
//
// When trustProxy is undefined the setting is left untouched, which
// keeps Express's safe default: X-Forwarded-For is ignored entirely.
export function applyTrustProxy(
  expressApp: {
    set(setting: string, value: unknown): void;
  },
  trustProxy: number | string | undefined,
): void {
  if (trustProxy === undefined) {
    return;
  }

  expressApp.set(
    'trust proxy',
    typeof trustProxy === 'number'
      ? trustProxy
      : trustProxy
          .split(',')
          .map((entry) => entry.trim()),
  );
}
