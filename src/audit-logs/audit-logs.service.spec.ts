import {
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { DatabaseService } from '../database/database.service';
import { AuditLogsService } from './audit-logs.service';

describe('AuditLogsService', () => {
  let service: AuditLogsService;
  let poolQuery: jest.Mock;

  beforeEach(async () => {
    poolQuery = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogsService,
        {
          provide: DatabaseService,
          useValue: {
            getPool: () => ({ query: poolQuery }),
            testConnection: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuditLogsService>(AuditLogsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAuditLog', () => {
    it('writes through the pool when no executor is supplied', async () => {
      poolQuery.mockResolvedValue({
        rows: [{ id: 12, module: 'SALES' }],
      });

      const result = await service.createAuditLog(
        9,
        'CREATE',
        'SALES',
        3,
        'Created sale: 3',
      );

      expect(result).toEqual({ id: 12, module: 'SALES' });
      expect(poolQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        [9, 'CREATE', 'SALES', 3, 'Created sale: 3'],
      );
    });

    it('writes through the supplied executor so the audit log joins the caller transaction', async () => {
      const executor = {
        query: jest.fn().mockResolvedValue({
          rows: [{ id: 13, module: 'PAYMENTS' }],
        }),
      };

      const result = await service.createAuditLog(
        9,
        'CREATE',
        'PAYMENTS',
        4,
        'Created payment: 4',
        executor,
      );

      expect(result).toEqual({ id: 13, module: 'PAYMENTS' });
      expect(executor.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        [9, 'CREATE', 'PAYMENTS', 4, 'Created payment: 4'],
      );
      expect(poolQuery).not.toHaveBeenCalled();
    });
  });

  describe('getAuditLogById', () => {
    it('throws NotFoundException for a missing audit log', async () => {
      poolQuery.mockResolvedValue({ rows: [] });

      await expect(
        service.getAuditLogById(999),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
