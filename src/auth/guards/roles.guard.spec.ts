import {
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflectorGet: jest.Mock;

  function contextWith(user?: {
    id: number;
    role: string;
  }): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    reflectorGet = jest.fn();
    guard = new RolesGuard({
      getAllAndOverride: reflectorGet,
    } as unknown as Reflector);
  });

  it('allows access when no roles are required', () => {
    reflectorGet.mockReturnValue(undefined);
    expect(guard.canActivate(contextWith())).toBe(true);
  });

  it('allows access for a matching role', () => {
    reflectorGet.mockReturnValue(['ADMIN', 'PHARMACIST']);
    expect(
      guard.canActivate(
        contextWith({ id: 1, role: 'PHARMACIST' }),
      ),
    ).toBe(true);
  });

  it('rejects a non-matching role', () => {
    reflectorGet.mockReturnValue(['ADMIN']);

    expect(() =>
      guard.canActivate(
        contextWith({ id: 1, role: 'CASHIER' }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects requests with no authenticated user', () => {
    reflectorGet.mockReturnValue(['ADMIN']);

    expect(() => guard.canActivate(contextWith())).toThrow(
      ForbiddenException,
    );
  });
});
