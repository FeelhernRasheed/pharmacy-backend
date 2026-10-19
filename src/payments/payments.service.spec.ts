import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DatabaseService } from '../database/database.service';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let clientQuery: jest.Mock;
  let clientRelease: jest.Mock;
  let auditMock: jest.Mock;

  beforeEach(async () => {
    clientQuery = jest.fn();
    clientRelease = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: DatabaseService,
          useValue: {
            getPool: () => ({
              query: jest.fn(),
              connect: async () => ({
                query: clientQuery,
                release: clientRelease,
              }),
            }),
          },
        },
        {
          provide: AuditLogsService,
          useValue: { createAuditLog: auditMock = jest.fn() },
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
    clientQuery.mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') {
        return Promise.resolve({});
      }

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
    expect(clientQuery).toHaveBeenCalledWith('COMMIT');
    expect(auditMock).toHaveBeenCalled();
  });

  it('rejects overpayment beyond the remaining balance', async () => {
    mockSaleFlow({ total: 100, paid: 60 });

    await expect(
      service.createPayment(
        { sale_id: 1, amount: 50, payment_method: 'CASH' },
        9,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(clientQuery).toHaveBeenCalledWith('ROLLBACK');
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
    clientQuery.mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') {
        return Promise.resolve({});
      }

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
