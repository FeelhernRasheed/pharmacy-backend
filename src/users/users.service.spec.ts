import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DatabaseService } from '../database/database.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let queryMock: jest.Mock;
  let auditMock: jest.Mock;

  beforeEach(async () => {
    queryMock = jest.fn();
    auditMock = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: DatabaseService,
          useValue: {
            getPool: () => ({ query: queryMock }),
          },
        },
        {
          provide: AuditLogsService,
          useValue: { createAuditLog: auditMock },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    const dto = {
      full_name: 'New Cashier',
      username: 'new_cashier',
      password: 'Secret123!',
      role: 'CASHIER' as const,
    };

    it('hashes the password before insert and never returns it', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 10,
              full_name: dto.full_name,
              username: dto.username,
              role: dto.role,
              status: 'ACTIVE',
            },
          ],
        });

      const result = await service.createUser(dto, 1);

      const insertParams = queryMock.mock.calls[1][1];
      const passwordHash = insertParams[2];

      expect(passwordHash).not.toBe(dto.password);
      expect(bcrypt.compareSync(dto.password, passwordHash)).toBe(
        true,
      );
      expect(result).not.toHaveProperty('password_hash');
      expect(auditMock).toHaveBeenCalled();
    });

    it('rejects a duplicate username', async () => {
      queryMock.mockResolvedValue({
        rows: [{ id: 1 }],
      });

      await expect(service.createUser(dto, 1)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('getUserById', () => {
    it('throws NotFoundException for a missing user', async () => {
      queryMock.mockResolvedValue({ rows: [] });

      await expect(service.getUserById(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
