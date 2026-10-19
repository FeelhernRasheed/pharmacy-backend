import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';

import { DatabaseService } from '../database/database.service';
import { AuthService } from './auth.service';

// bcrypt's native exports are non-configurable, so wrap compare in a
// pass-through jest.fn to count calls without changing behavior.
jest.mock('bcrypt', () => {
  const actual =
    jest.requireActual<typeof import('bcrypt')>('bcrypt');
  return {
    ...actual,
    compare: jest.fn(actual.compare),
  };
});

describe('AuthService', () => {
  let service: AuthService;
  let queryMock: jest.Mock;
  let signMock: jest.Mock;

  const activeUser = {
    id: 1,
    full_name: 'Test Admin',
    username: 'test_admin',
    password_hash: bcrypt.hashSync('correct-pass', 4),
    role: 'ADMIN',
    status: 'ACTIVE',
  };

  beforeEach(async () => {
    queryMock = jest.fn();
    signMock = jest.fn().mockResolvedValue('signed-token');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: DatabaseService,
          useValue: {
            getPool: () => ({ query: queryMock }),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: signMock,
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('returns a token for valid credentials', async () => {
      queryMock.mockResolvedValue({ rows: [activeUser] });

      const result = await service.login({
        username: 'test_admin',
        password: 'correct-pass',
      });

      expect(result.access_token).toBe('signed-token');
      expect(result.user).toEqual({
        id: 1,
        full_name: 'Test Admin',
        username: 'test_admin',
        role: 'ADMIN',
      });
      expect(result.user).not.toHaveProperty('password_hash');
    });

    it('rejects an unknown user', async () => {
      queryMock.mockResolvedValue({ rows: [] });

      await expect(
        service.login({ username: 'ghost', password: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('still performs a bcrypt compare for unknown users (timing safety)', async () => {
      queryMock.mockResolvedValue({ rows: [] });
      const compareMock = bcrypt.compare as unknown as jest.Mock;
      compareMock.mockClear();

      await expect(
        service.login({ username: 'ghost', password: 'x' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(compareMock).toHaveBeenCalledTimes(1);
    });

    it('rejects an inactive user with the generic login error', async () => {
      queryMock.mockResolvedValue({
        rows: [{ ...activeUser, status: 'INACTIVE' }],
      });

      await expect(
        service.login({
          username: 'test_admin',
          password: 'correct-pass',
        }),
      ).rejects.toThrow('Invalid username or password');
    });

    it('returns the same generic error for unknown, inactive, and wrong-password logins', async () => {
      const messageOf = async (
        attempt: () => Promise<unknown>,
      ): Promise<string | null> => {
        try {
          await attempt();
          return null;
        } catch (error) {
          return error instanceof Error
            ? error.message
            : String(error);
        }
      };

      queryMock.mockResolvedValueOnce({ rows: [] });
      const unknownUserMessage = await messageOf(() =>
        service.login({ username: 'ghost', password: 'x' }),
      );

      queryMock.mockResolvedValueOnce({
        rows: [{ ...activeUser, status: 'INACTIVE' }],
      });
      const inactiveUserMessage = await messageOf(() =>
        service.login({
          username: 'test_admin',
          password: 'correct-pass',
        }),
      );

      queryMock.mockResolvedValueOnce({ rows: [activeUser] });
      const wrongPasswordMessage = await messageOf(() =>
        service.login({
          username: 'test_admin',
          password: 'wrong-pass',
        }),
      );

      expect(unknownUserMessage).toBe(
        'Invalid username or password',
      );
      expect(inactiveUserMessage).toBe(unknownUserMessage);
      expect(wrongPasswordMessage).toBe(unknownUserMessage);
    });

    it('performs a bcrypt compare for inactive users and issues no token', async () => {
      queryMock.mockResolvedValue({
        rows: [{ ...activeUser, status: 'INACTIVE' }],
      });
      const compareMock = bcrypt.compare as unknown as jest.Mock;
      compareMock.mockClear();
      signMock.mockClear();

      await expect(
        service.login({
          username: 'test_admin',
          password: 'correct-pass',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(compareMock).toHaveBeenCalledTimes(1);
      expect(signMock).not.toHaveBeenCalled();
    });

    it('rejects a wrong password', async () => {
      queryMock.mockResolvedValue({ rows: [activeUser] });

      await expect(
        service.login({
          username: 'test_admin',
          password: 'wrong-pass',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
