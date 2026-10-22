import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { createDatabaseServiceMock } from '../../test/support/database-service.mock';
import type { DatabaseServiceMock } from '../../test/support/database-service.mock';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DatabaseService } from '../database/database.service';
import { SaleItemsService } from './sale-items.service';

describe('SaleItemsService', () => {
  let service: SaleItemsService;
  let database: DatabaseServiceMock;
  let queryMock: jest.Mock;
  let auditMock: jest.Mock;

  beforeEach(async () => {
    queryMock = jest.fn();
    auditMock = jest.fn();
    database = createDatabaseServiceMock(queryMock);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaleItemsService,
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

    service = module.get<SaleItemsService>(SaleItemsService);
  });

  function mockSaleFlow(opts?: {
    quantity?: number;
    sellingPrice?: string;
    expiryDate?: string;
    status?: string;
  }) {
    queryMock.mockImplementation((sql: string) => {
      if (sql.includes('FROM sales')) {
        return Promise.resolve({
          rows: [{ id: 1, status: opts?.status ?? 'PENDING' }],
        });
      }

      if (sql.includes('FROM medicine_batches')) {
        return Promise.resolve({
          rows: [
            {
              id: 2,
              quantity: opts?.quantity ?? 100,
              selling_price: opts?.sellingPrice ?? '12.50',
              expiry_date: opts?.expiryDate ?? '2099-12-31',
            },
          ],
        });
      }

      if (sql.includes('CURRENT_DATE')) {
        return Promise.resolve({
          rows: [{ today: '2026-01-01' }],
        });
      }

      if (sql.includes('INSERT INTO sale_items')) {
        return Promise.resolve({
          rows: [
            {
              id: 5,
              sale_id: 1,
              batch_id: 2,
              quantity: 3,
              unit_price: '12.50',
              subtotal: '37.50',
            },
          ],
        });
      }

      return Promise.resolve({ rows: [] });
    });
  }

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('uses the batch price and ignores the price sent by the client', async () => {
    mockSaleFlow();

    const result = await service.createSaleItem(
      { sale_id: 1, batch_id: 2, quantity: 3, unit_price: 0.01 },
      9,
    );

    expect(result.unit_price).toBe('12.50');

    const insertCall = queryMock.mock.calls.find(
      ([sql]: [string]) => sql.includes('INSERT INTO sale_items'),
    );

    expect(insertCall).toBeDefined();
    expect(insertCall![1]).toEqual([1, 2, 3, '12.50']);
    expect(insertCall![0]).toContain('$4::numeric * $3::int');
  });

  it('records a price mismatch in the audit log', async () => {
    mockSaleFlow();

    await service.createSaleItem(
      { sale_id: 1, batch_id: 2, quantity: 3, unit_price: 0.01 },
      9,
    );

    expect(auditMock).toHaveBeenCalledWith(
      9,
      'CREATE',
      'SALE_ITEMS',
      5,
      expect.stringContaining('client requested unit_price: 0.01'),
      database.client,
    );
  });

  it('does not report a mismatch when the client sends the server price', async () => {
    mockSaleFlow();

    await service.createSaleItem(
      { sale_id: 1, batch_id: 2, quantity: 3, unit_price: 12.5 },
      9,
    );

    expect(auditMock).toHaveBeenCalledWith(
      9,
      'CREATE',
      'SALE_ITEMS',
      5,
      expect.not.stringContaining('client requested unit_price'),
      database.client,
    );
  });

  it('accepts a request without a unit price', async () => {
    mockSaleFlow();

    const result = await service.createSaleItem(
      { sale_id: 1, batch_id: 2, quantity: 3 },
      9,
    );

    expect(result.subtotal).toBe('37.50');
    expect(database.transaction).toHaveBeenCalledWith('COMMIT');
  });

  it('writes the audit log inside the stock transaction', async () => {
    mockSaleFlow();

    await service.createSaleItem(
      { sale_id: 1, batch_id: 2, quantity: 3 },
      9,
    );

    expect(auditMock).toHaveBeenCalledWith(
      9,
      'CREATE',
      'SALE_ITEMS',
      5,
      expect.any(String),
      database.client,
    );
  });

  it('rolls back the stock deduction when the audit log cannot be written', async () => {
    mockSaleFlow();

    auditMock.mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(
      service.createSaleItem(
        { sale_id: 1, batch_id: 2, quantity: 3 },
        9,
      ),
    ).rejects.toThrow('audit unavailable');

    expect(database.transaction).toHaveBeenCalledWith('ROLLBACK');
    expect(database.transaction).not.toHaveBeenCalledWith('COMMIT');
  });

  it('rejects selling more than the available stock', async () => {
    mockSaleFlow({ quantity: 2 });

    await expect(
      service.createSaleItem(
        { sale_id: 1, batch_id: 2, quantity: 3 },
        9,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(auditMock).not.toHaveBeenCalled();
  });

  it('rejects selling expired medicine', async () => {
    mockSaleFlow({ expiryDate: '2020-01-01' });

    await expect(
      service.createSaleItem(
        { sale_id: 1, batch_id: 2, quantity: 1 },
        9,
      ),
    ).rejects.toThrow('Cannot sell expired medicine');
  });
});
