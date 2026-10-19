import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DatabaseService } from '../database/database.service';
import { SalesService } from './sales.service';

describe('SalesService', () => {
  let service: SalesService;
  let clientQuery: jest.Mock;
  let clientRelease: jest.Mock;
  let poolQuery: jest.Mock;
  let auditMock: jest.Mock;

  beforeEach(async () => {
    clientQuery = jest.fn();
    clientRelease = jest.fn();
    poolQuery = jest.fn();
    auditMock = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        {
          provide: DatabaseService,
          useValue: {
            getPool: () => ({
              query: poolQuery,
              connect: async () => ({
                query: clientQuery,
                release: clientRelease,
              }),
            }),
          },
        },
        {
          provide: AuditLogsService,
          useValue: { createAuditLog: auditMock },
        },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
  });

  describe('updateSale', () => {
    it('restores stock when cancelling a sale', async () => {
      clientQuery.mockImplementation((sql: string) => {
        if (sql === 'BEGIN' || sql === 'COMMIT') {
          return Promise.resolve({});
        }

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

      const stockRestoreCall = clientQuery.mock.calls.find(
        ([sql]: [string]) =>
          sql.includes('UPDATE medicine_batches'),
      );
      expect(stockRestoreCall).toBeDefined();
      expect(clientQuery).toHaveBeenCalledWith('COMMIT');
      expect(auditMock).toHaveBeenCalled();
    });

    it('rejects cancelling a sale with completed payments', async () => {
      clientQuery.mockImplementation((sql: string) => {
        if (sql === 'BEGIN' || sql === 'ROLLBACK') {
          return Promise.resolve({});
        }

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
    });

    it('rejects reopening a cancelled sale', async () => {
      clientQuery.mockImplementation((sql: string) => {
        if (sql === 'BEGIN' || sql === 'ROLLBACK') {
          return Promise.resolve({});
        }

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
      poolQuery.mockResolvedValue({
        rows: [{ sale_items: '2', payments: '1' }],
      });

      await expect(service.deleteSale(1, 9)).rejects.toThrow(
        ConflictException,
      );
    });

    it('deletes an empty sale', async () => {
      poolQuery
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
      poolQuery
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
