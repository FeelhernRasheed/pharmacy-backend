import { BadRequestException } from '@nestjs/common';
import { Request } from 'express';

import { resolveIdempotencyKey } from './idempotency-key';

function buildRequest(headers: Record<string, string>): Request {
  return {
    header: (name: string) => headers[name],
  } as unknown as Request;
}

describe('resolveIdempotencyKey', () => {
  it('returns a valid Idempotency-Key header', () => {
    const request = buildRequest({
      'Idempotency-Key': 'order-12345678',
    });

    expect(resolveIdempotencyKey(request)).toBe('order-12345678');
  });

  it('trims the Idempotency-Key header', () => {
    const request = buildRequest({
      'Idempotency-Key': '  order-12345678  ',
    });

    expect(resolveIdempotencyKey(request)).toBe('order-12345678');
  });

  it('rejects an Idempotency-Key with an unsafe value', () => {
    const request = buildRequest({
      'Idempotency-Key': 'short',
    });

    expect(() => resolveIdempotencyKey(request)).toThrow(
      BadRequestException,
    );
  });

  it('rejects an Idempotency-Key that is too long', () => {
    const request = buildRequest({
      'Idempotency-Key': 'a'.repeat(129),
    });

    expect(() => resolveIdempotencyKey(request)).toThrow(
      BadRequestException,
    );
  });

  it('does not use X-Request-Id as an idempotency key', () => {
    const request = buildRequest({
      'X-Request-Id': 'request-12345678',
    });

    expect(resolveIdempotencyKey(request)).toBeUndefined();
  });

  it('ignores an invalid X-Request-Id header', () => {
    const request = buildRequest({
      'X-Request-Id': 'short',
    });

    expect(resolveIdempotencyKey(request)).toBeUndefined();
  });

  it('prefers the explicit key over X-Request-Id', () => {
    const request = buildRequest({
      'Idempotency-Key': 'order-12345678',
      'X-Request-Id': 'request-87654321',
    });

    expect(resolveIdempotencyKey(request)).toBe('order-12345678');
  });

  it('returns undefined when no key header is present', () => {
    const request = buildRequest({});

    expect(resolveIdempotencyKey(request)).toBeUndefined();
  });
});
