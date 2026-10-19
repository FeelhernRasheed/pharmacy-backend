import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { DatabaseService } from '../../database/database.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let queryMock: jest.Mock;

  beforeEach(async () => {
    queryMock = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: () => 'test-secret',
          },
        },
        {
          provide: DatabaseService,
          useValue: {
            getPool: () => ({ query: queryMock }),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('returns user info for an active user', async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          id: 5,
          username: 'pharm',
          role: 'PHARMACIST',
          status: 'ACTIVE',
        },
      ],
    });

    const result = await strategy.validate({
      sub: 5,
      username: 'pharm',
      role: 'PHARMACIST',
    });

    expect(result).toEqual({
      userId: 5,
      username: 'pharm',
      role: 'PHARMACIST',
    });
  });

  it('rejects a deleted user', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    await expect(
      strategy.validate({
        sub: 99,
        username: 'gone',
        role: 'ADMIN',
      }),
    ).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an inactive user', async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          id: 5,
          username: 'pharm',
          role: 'PHARMACIST',
          status: 'INACTIVE',
        },
      ],
    });

    await expect(
      strategy.validate({
        sub: 5,
        username: 'pharm',
        role: 'PHARMACIST',
      }),
    ).rejects.toThrow('User account is not active');
  });
});
