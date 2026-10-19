import { NextFunction, Request, Response } from 'express';

import {
  getRequestId,
  requestIdMiddleware,
} from './request-id.middleware';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('requestIdMiddleware', () => {
  let request: Partial<Request>;
  let response: Partial<Response>;
  let next: jest.Mock;
  let setHeaderMock: jest.Mock;

  const run = (incoming?: string) => {
    request = {
      header: jest.fn().mockReturnValue(incoming),
    } as unknown as Request;
    setHeaderMock = jest.fn();
    response = { setHeader: setHeaderMock } as unknown as Response;
    next = jest.fn() as NextFunction as jest.Mock;

    requestIdMiddleware(
      request as Request,
      response as Response,
      next,
    );
  };

  it('generates a UUID when no header is sent and calls next', () => {
    run();

    const id = getRequestId(request as Request);
    expect(id).toMatch(UUID_PATTERN);
    expect(setHeaderMock).toHaveBeenCalledWith('X-Request-Id', id);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('reuses a valid incoming X-Request-Id', () => {
    run('trace-abc-1234');

    expect(getRequestId(request as Request)).toBe(
      'trace-abc-1234',
    );
    expect(setHeaderMock).toHaveBeenCalledWith(
      'X-Request-Id',
      'trace-abc-1234',
    );
  });

  it.each([
    ['too short', 'abc'],
    ['with spaces', 'bad id value'],
    ['with markup', 'id<script>alert(1)</script>'],
    ['too long', 'a'.repeat(65)],
  ])('replaces an invalid header (%s)', (_label, incoming) => {
    run(incoming);

    const id = getRequestId(request as Request);
    expect(id).toMatch(UUID_PATTERN);
    expect(id).not.toBe(incoming);
  });
});
