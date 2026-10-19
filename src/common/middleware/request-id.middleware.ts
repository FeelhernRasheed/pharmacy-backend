import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

const REQUEST_ID_HEADER = 'X-Request-Id';

// Accepted from the caller only when it looks like a sane
// correlation token; anything else (too long, odd characters)
// is replaced so logs cannot be poisoned via header values.
const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

export type RequestWithId = Request & { id?: string };

export function getRequestId(request: Request): string | undefined {
  return (request as RequestWithId).id;
}

/**
 * Lightweight request-correlation middleware: reuses a valid
 * incoming X-Request-Id or generates a UUID, attaches it to the
 * request, and echoes it on the response.
 */
export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const incoming = request.header(REQUEST_ID_HEADER);
  const id =
    incoming !== undefined && VALID_REQUEST_ID.test(incoming)
      ? incoming
      : randomUUID();

  (request as RequestWithId).id = id;
  response.setHeader(REQUEST_ID_HEADER, id);
  next();
}
