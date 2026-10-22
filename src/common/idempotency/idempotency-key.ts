import { BadRequestException } from '@nestjs/common';
import { Request } from 'express';

// An idempotency key is opaque but must not be able to poison logs
// or blow up the primary key index, so it is restricted to a small
// safe alphabet.
const VALID_IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,128}$/;

/**
 * Resolves the idempotency key of a request.
 *
 * Only an explicit `Idempotency-Key` header is used. A correlation id
 * (`X-Request-Id`) is deliberately NOT accepted as a fallback: a
 * correlation id identifies a request for logging, it does not promise
 * that the request may be retried. Treating it as an idempotency key
 * made a client that reuses one correlation id for several requests
 * receive the response of the first one while its own business change
 * was never executed.
 *
 * Returns `undefined` when the header is absent: such a request is
 * executed without idempotency protection and no key row is written.
 */
export function resolveIdempotencyKey(
  request: Request,
): string | undefined {
  const header = request.header('Idempotency-Key');

  if (header === undefined) {
    return undefined;
  }

  const key = header.trim();

  if (!VALID_IDEMPOTENCY_KEY.test(key)) {
    throw new BadRequestException(
      'Idempotency-Key must be 8-128 characters long and may only contain A-Z, a-z, 0-9, ".", "_", ":" or "-"',
    );
  }

  return key;
}
