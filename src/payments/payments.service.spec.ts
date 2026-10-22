import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { createDatabaseServiceMock } from '../../test/support/database-service.mock';
import type { DatabaseServiceMock } from '../../test/support/database-service.mock';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DatabaseService } from '../database/database.service';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let database: DatabaseServiceMock;
  let queryMock: jest.Mock;
  let auditMock: jest.Mock;

  beforeEach(async () => {
    queryMock = jest.fn();
    auditMock = jest.fn();
    database = createDatabaseServiceMock(queryMock);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
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

    service = module.get<PaymentsService>(PaymentsService);
  });

  function mockSaleFlow(opts: {
    total: number;
    paid: number;
    status?: string;
    inserted?: Record<string, unknown>;
  }) {
    queryMock.mockImplementation((sql: string) => {
      if (sql.includes('FROM sales')) {
        return Promise.resolve({
          rows: [
            {
              id: 1,
              total_amount: opts.total,
              status: opts.status ?? 'PENDING',
            },
          ],
        });
      }

      if (sql.includes('SUM(amount)')) {
        return Promise.resolve({
          rows: [{ paid_amount: opts.paid }],
        });
      }

      if (sql.includes('INSERT INTO payments')) {
        return Promise.resolve({
          rows: [opts.inserted ?? { id: 50, sale_id: 1 }],
        });
      }

      return Promise.resolve({ rows: [] });
    });
  }

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('records a payment within the remaining balance', async () => {
    mockSaleFlow({
      total: 100,
      paid: 60,
      inserted: { id: 7, sale_id: 1, amount: 40 },
    });

    const result = await service.createPayment(
      { sale_id: 1, amount: 40, payment_method: 'CASH' },
      9,
    );

    expect(result.id).toBe(7);
    expect(database.transaction).toHaveBeenCalledWith('COMMIT');
    expect(auditMock).toHaveBeenCalled();
  });

  it('writes the audit log inside the payment transaction', async () => {
    mockSaleFlow({
      total: 100,
      paid: 60,
      inserted: { id: 7, sale_id: 1, amount: 40 },
    });

    await service.createPayment(
      { sale_id: 1, amount: 40, payment_method: 'CASH' },
      9,
    );

    expect(auditMock).toHaveBeenCalledWith(
      9,
      'CREATE',
      'PAYMENTS',
      7,
      expect.stringContaining('payment: 7'),
      database.client,
    );
  });

  it('rolls back the payment when the audit log cannot be written', async () => {
    mockSaleFlow({
      total: 100,
      paid: 60,
      inserted: { id: 7, sale_id: 1, amount: 40 },
    });

    auditMock.mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(
      service.createPayment(
        { sale_id: 1, amount: 40, payment_method: 'CASH' },
        9,
      ),
    ).rejects.toThrow('audit unavailable');

    expect(database.transaction).toHaveBeenCalledWith('ROLLBACK');
    expect(database.transaction).not.toHaveBeenCalledWith('COMMIT');
  });

  it('does not open its own transaction when a client is supplied', async () => {
    const externalClient = {
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM sales')) {
          return Promise.resolve({
            rows: [
              { id: 1, total_amount: 100, status: 'PENDING' },
            ],
          });
        }

        if (sql.includes('SUM(amount)')) {
          return Promise.resolve({
            rows: [{ paid_amount: 0 }],
          });
        }

        return Promise.resolve({
          rows: [{ id: 11, sale_id: 1 }],
        });
      }),
      release: jest.fn(),
    };

    const result = await service.createPayment(
      { sale_id: 1, amount: 40, payment_method: 'CASH' },
      9,
      externalClient as never,
    );

    expect(result.id).toBe(11);
    expect(database.transaction).not.toHaveBeenCalled();
    expect(auditMock).toHaveBeenCalledWith(
      9,
      'CREATE',
      'PAYMENTS',
      11,
      expect.any(String),
      externalClient,
    );
  });

  it('rejects overpayment beyond the remaining balance', async () => {
    mockSaleFlow({ total: 100, paid: 60 });

    await expect(
      service.createPayment(
        { sale_id: 1, amount: 50, payment_method: 'CASH' },
        9,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(database.transaction).toHaveBeenCalledWith('ROLLBACK');
  });

  it('rejects payment for a cancelled sale', async () => {
    mockSaleFlow({
      total: 100,
      paid: 0,
      status: 'CANCELLED',
    });

    await expect(
      service.createPayment(
        { sale_id: 1, amount: 10, payment_method: 'CASH' },
      ),
    ).rejects.toThrow(
      'Cannot record a payment for a cancelled sale',
    );
  });

  it('rejects payment for a missing sale', async () => {
    queryMock.mockImplementation((sql: string) => {
      if (sql.includes('FROM sales')) {
        return Promise.resolve({ rows: [] });
      }

      return Promise.resolve({ rows: [] });
    });

    await expect(
      service.createPayment(
        { sale_id: 404, amount: 10, payment_method: 'CASH' },
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
