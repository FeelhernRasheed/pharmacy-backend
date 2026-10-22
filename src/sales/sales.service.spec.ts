import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { createDatabaseServiceMock } from '../../test/support/database-service.mock';
import type { DatabaseServiceMock } from '../../test/support/database-service.mock';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DatabaseService } from '../database/database.service';
import { SalesService } from './sales.service';

describe('SalesService', () => {
  let service: SalesService;
  let database: DatabaseServiceMock;
  let queryMock: jest.Mock;
  let auditMock: jest.Mock;

  beforeEach(async () => {
    queryMock = jest.fn();
    auditMock = jest.fn();
    database = createDatabaseServiceMock(queryMock);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        {
          provide: DatabaseService,
          useValue: database.provider,
        },
        {
          provide: AuditLogsService,
          useValue: { createAuditLog: auditMock },
        },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
  });

  describe('createSale', () => {
    it('writes the audit log inside the same transaction', async () => {
      queryMock.mockResolvedValue({
        rows: [{ id: 3, patient_id: null }],
      });

      const result = await service.createSale({}, 9);

      expect(result.id).toBe(3);
      expect(database.transaction).toHaveBeenCalledWith('BEGIN');
      expect(database.transaction).toHaveBeenCalledWith('COMMIT');
      expect(auditMock).toHaveBeenCalledWith(
        9,
        'CREATE',
        'SALES',
        3,
        expect.stringContaining('Created sale: 3'),
        database.client,
      );
    });

    it('rolls back the sale when the audit log cannot be written', async () => {
      queryMock.mockResolvedValue({
        rows: [{ id: 3, patient_id: null }],
      });

      auditMock.mockRejectedValueOnce(new Error('audit unavailable'));

      await expect(service.createSale({}, 9)).rejects.toThrow(
        'audit unavailable',
      );

      expect(database.transaction).toHaveBeenCalledWith('ROLLBACK');
      expect(database.transaction).not.toHaveBeenCalledWith('COMMIT');
    });

    it('does not open its own transaction when a client is supplied', async () => {
      const externalClient = {
        query: jest.fn().mockResolvedValue({
          rows: [{ id: 4, patient_id: null }],
        }),
        release: jest.fn(),
      };

      const result = await service.createSale(
        {},
        9,
        externalClient as never,
      );

      expect(result.id).toBe(4);
      expect(database.transaction).not.toHaveBeenCalled();
      expect(auditMock).toHaveBeenCalledWith(
        9,
        'CREATE',
        'SALES',
        4,
        expect.any(String),
        externalClient,
      );
    });
  });

  describe('updateSale', () => {
    it('restores stock when cancelling a sale', async () => {
      queryMock.mockImplementation((sql: string) => {
        if (sql.includes('SELECT id, status FROM sales')) {
          return Promise.resolve({
            rows: [{ id: 1, status: 'PENDING' }],
          });
        }

        if (sql.includes('COUNT(*)')) {
          return Promise.resolve({
            rows: [{ payment_count: '0' }],
          });
        }

        if (sql.includes('UPDATE medicine_batches')) {
          return Promise.resolve({});
        }

        if (sql.includes('UPDATE sales')) {
          return Promise.resolve({
            rows: [{ id: 1, status: 'CANCELLED' }],
          });
        }

        return Promise.resolve({ rows: [] });
      });

      const result = await service.updateSale(
        1,
        'CANCELLED',
        9,
      );

      expect(result.status).toBe('CANCELLED');

      const stockRestoreCall = queryMock.mock.calls.find(
        ([sql]: [string]) =>
          sql.includes('UPDATE medicine_batches'),
      );
      expect(stockRestoreCall).toBeDefined();
      expect(database.transaction).toHaveBeenCalledWith('COMMIT');
      expect(auditMock).toHaveBeenCalled();
    });

    it('rejects cancelling a sale with completed payments', async () => {
      queryMock.mockImplementation((sql: string) => {
        if (sql.includes('SELECT id, status FROM sales')) {
          return Promise.resolve({
            rows: [{ id: 1, status: 'PENDING' }],
          });
        }

        if (sql.includes('COUNT(*)')) {
          return Promise.resolve({
            rows: [{ payment_count: '2' }],
          });
        }

        return Promise.resolve({ rows: [] });
      });

      await expect(
        service.updateSale(1, 'CANCELLED', 9),
      ).rejects.toThrow(
        'Cannot cancel a sale that has completed payments',
      );

      expect(database.transaction).toHaveBeenCalledWith('ROLLBACK');
    });

    it('rejects reopening a cancelled sale', async () => {
      queryMock.mockImplementation((sql: string) => {
        if (sql.includes('SELECT id, status FROM sales')) {
          return Promise.resolve({
            rows: [{ id: 1, status: 'CANCELLED' }],
          });
        }

        return Promise.resolve({ rows: [] });
      });

      await expect(
        service.updateSale(1, 'COMPLETED', 9),
      ).rejects.toThrow(
        'A cancelled sale cannot be reopened',
      );
    });

    it('rejects an invalid status value', async () => {
      await expect(
        service.updateSale(1, 'HACKED', 9),
      ).rejects.toThrow('Invalid sale status');
    });
  });

  describe('deleteSale', () => {
    it('blocks deleting a sale that has items or payments', async () => {
      queryMock.mockResolvedValue({
        rows: [{ sale_items: '2', payments: '1' }],
      });

      await expect(service.deleteSale(1, 9)).rejects.toThrow(
        ConflictException,
      );
    });

    it('deletes an empty sale', async () => {
      queryMock
        .mockResolvedValueOnce({
          rows: [{ sale_items: '0', payments: '0' }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: 'PENDING' }],
        });

      const result = await service.deleteSale(1, 9);

      expect(result.message).toBe('Sale deleted successfully');
      expect(auditMock).toHaveBeenCalled();
    });

    it('throws NotFoundException for a missing sale', async () => {
      queryMock
        .mockResolvedValueOnce({
          rows: [{ sale_items: '0', payments: '0' }],
        })
        .mockResolvedValueOnce({ rows: [] });

      await expect(service.deleteSale(404, 9)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
