import { createHash } from 'node:crypto';

/**
 * Canonical representation of a request payload.
 *
 * The goal is that two requests that mean the same thing produce the
 * same string, so that the fingerprint of a retry can be compared with
 * the fingerprint stored for the original request:
 *
 *   * object keys are sorted, so `{a: 1, b: 2}` and `{b: 2, a: 1}`
 *     are equal;
 *   * `undefined` properties are dropped, so an absent property and an
 *     explicitly `undefined` one are equal;
 *   * numbers are normalised by their JSON representation, so `5` and
 *     `5.0` are equal;
 *   * arrays keep their order, because the order of a list is part of
 *     its meaning;
 *   * `null` stays distinct from an absent property.
 */
export function canonicalizePayload(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  }

  if (typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalizePayload(entry)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0,
      );

    return `{${entries
      .map(
        ([key, entry]) =>
          `${JSON.stringify(key)}:${canonicalizePayload(entry)}`,
      )
      .join(',')}}`;
  }

  return 'null';
}

/**
 * Fingerprint of a request: the HTTP method, the endpoint and the
 * canonical payload, hashed with SHA-256.
 *
 * The fingerprint is stored next to the idempotency key. A repeated
 * request is only replayed when its fingerprint matches the stored
 * one, so a key that is reused with a different payload is rejected
 * instead of silently answering with the response of the first
 * request.
 */
export function fingerprintRequest(input: {
  method: string;
  endpoint: string;
  payload: unknown;
}): string {
  const canonical = `${input.method.toUpperCase()}\n${input.endpoint}\n${canonicalizePayload(input.payload)}`;

  return createHash('sha256').update(canonical).digest('hex');
}
