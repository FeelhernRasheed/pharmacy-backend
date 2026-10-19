import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';

import { DatabaseService } from '../database/database.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let queryMock: jest.Mock;

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
            signAsync: jest.fn().mockResolvedValue('signed-token'),
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

    it('rejects an inactive user', async () => {
      queryMock.mockResolvedValue({
        rows: [{ ...activeUser, status: 'INACTIVE' }],
      });

      await expect(
        service.login({
          username: 'test_admin',
          password: 'correct-pass',
        }),
      ).rejects.toThrow('User account is not active');
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
