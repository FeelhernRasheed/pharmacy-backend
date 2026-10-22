import {
  canonicalizePayload,
  fingerprintRequest,
} from './request-fingerprint';

describe('canonicalizePayload', () => {
  it('sorts object keys', () => {
    expect(canonicalizePayload({ b: 2, a: 1 })).toBe(
      canonicalizePayload({ a: 1, b: 2 }),
    );
  });

  it('sorts nested object keys', () => {
    expect(
      canonicalizePayload({ outer: { z: 1, a: 2 } }),
    ).toBe(canonicalizePayload({ outer: { a: 2, z: 1 } }));
  });

  it('keeps the order of arrays', () => {
    expect(canonicalizePayload([1, 2])).not.toBe(
      canonicalizePayload([2, 1]),
    );
  });

  it('treats a missing property and an undefined property as equal', () => {
    expect(canonicalizePayload({ a: 1, b: undefined })).toBe(
      canonicalizePayload({ a: 1 }),
    );
  });

  it('treats null and a missing property as different', () => {
    expect(canonicalizePayload({ a: null })).not.toBe(
      canonicalizePayload({}),
    );
  });

  it('normalises numbers', () => {
    expect(canonicalizePayload({ amount: 5 })).toBe(
      canonicalizePayload({ amount: 5.0 }),
    );
  });

  it('keeps a string and a number apart', () => {
    expect(canonicalizePayload({ amount: 5 })).not.toBe(
      canonicalizePayload({ amount: '5' }),
    );
  });

  it('serialises dates as ISO strings', () => {
    expect(canonicalizePayload({ at: new Date('2026-01-01T00:00:00Z') })).toBe(
      '{"at":"2026-01-01T00:00:00.000Z"}',
    );
  });
});

describe('fingerprintRequest', () => {
  it('is stable for equivalent payloads', () => {
    const left = fingerprintRequest({
      method: 'post',
      endpoint: 'POST /payments',
      payload: { sale_id: 1, amount: 25.5, method: 'cash' },
    });

    const right = fingerprintRequest({
      method: 'POST',
      endpoint: 'POST /payments',
      payload: { method: 'cash', amount: 25.5, sale_id: 1 },
    });

    expect(left).toBe(right);
    expect(left).toMatch(/^[a-f0-9]{64}$/);
  });

  it('differs for a different payload', () => {
    const left = fingerprintRequest({
      method: 'POST',
      endpoint: 'POST /payments',
      payload: { sale_id: 1, amount: 25.5 },
    });

    const right = fingerprintRequest({
      method: 'POST',
      endpoint: 'POST /payments',
      payload: { sale_id: 1, amount: 30 },
    });

    expect(left).not.toBe(right);
  });

  it('differs for a different endpoint', () => {
    const left = fingerprintRequest({
      method: 'POST',
      endpoint: 'POST /payments',
      payload: { sale_id: 1 },
    });

    const right = fingerprintRequest({
      method: 'POST',
      endpoint: 'POST /sales',
      payload: { sale_id: 1 },
    });

    expect(left).not.toBe(right);
  });

  it('differs for a different method', () => {
    const left = fingerprintRequest({
      method: 'POST',
      endpoint: 'POST /payments',
      payload: { sale_id: 1 },
    });

    const right = fingerprintRequest({
      method: 'PUT',
      endpoint: 'POST /payments',
      payload: { sale_id: 1 },
    });

    expect(left).not.toBe(right);
  });
});
