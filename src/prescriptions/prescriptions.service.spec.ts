import { Test, TestingModule } from '@nestjs/testing';

import { createDatabaseServiceMock } from '../../test/support/database-service.mock';
import type { DatabaseServiceMock } from '../../test/support/database-service.mock';

import { DatabaseService } from '../database/database.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrescriptionsService } from './prescriptions.service';

describe('PrescriptionsService', () => {
  let service: PrescriptionsService;
  let database: DatabaseServiceMock;
  let queryMock: jest.Mock;
  let auditMock: jest.Mock;

  beforeEach(async () => {
    queryMock = jest.fn();
    auditMock = jest.fn().mockResolvedValue(undefined);
    database = createDatabaseServiceMock(queryMock);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrescriptionsService,
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

    service = module.get<PrescriptionsService>(PrescriptionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPrescriptionItem', () => {
    const itemDto = {
      prescription_id: 5,
      medicine_id: 3,
      dosage: '1 tablet',
      frequency: 'twice daily',
      duration: '5 days',
      quantity: 10,
      instructions: 'after meals',
    };

    it('rejects adding an item to a completed prescription', async () => {
      queryMock.mockResolvedValue({
        rows: [{ id: 5, status: 'COMPLETED' }],
      });

      await expect(
        service.createPrescriptionItem(itemDto, 1),
      ).rejects.toThrow('Cannot add items to a completed prescription');

      expect(queryMock).toHaveBeenCalledTimes(1);
      expect(auditMock).not.toHaveBeenCalled();
      expect(database.transaction).toHaveBeenCalledWith('ROLLBACK');
    });

    it('still creates an item for a pending prescription', async () => {
      const createdItem = {
        id: 9,
        prescription_id: 5,
        medicine_id: 3,
        dosage: itemDto.dosage,
        frequency: itemDto.frequency,
        duration: itemDto.duration,
        quantity: itemDto.quantity,
        instructions: itemDto.instructions,
      };

      queryMock
        .mockResolvedValueOnce({
          rows: [{ id: 5, status: 'PENDING' }],
        })
        .mockResolvedValueOnce({ rows: [{ id: 3 }] })
        .mockResolvedValueOnce({ rows: [createdItem] });

      const result = await service.createPrescriptionItem(itemDto, 1);

      expect(result).toEqual(createdItem);
      expect(auditMock).toHaveBeenCalledWith(
        1,
        'CREATE',
        'PRESCRIPTION_ITEMS',
        9,
        expect.stringContaining('prescription: 5'),
        database.client,
      );
    });

    it('rolls the item back when the audit log cannot be written', async () => {
      queryMock
        .mockResolvedValueOnce({
          rows: [{ id: 5, status: 'PENDING' }],
        })
        .mockResolvedValueOnce({ rows: [{ id: 3 }] })
        .mockResolvedValueOnce({ rows: [{ id: 9 }] });

      auditMock.mockRejectedValueOnce(new Error('audit unavailable'));

      await expect(
        service.createPrescriptionItem(itemDto, 1),
      ).rejects.toThrow('audit unavailable');

      expect(database.transaction).toHaveBeenCalledWith('ROLLBACK');
      expect(database.transaction).not.toHaveBeenCalledWith('COMMIT');
    });

    it('allows adding items while the prescription is partially dispensed', async () => {
      queryMock
        .mockResolvedValueOnce({
          rows: [{ id: 5, status: 'PARTIALLY_DISPENSED' }],
        })
        .mockResolvedValueOnce({ rows: [{ id: 3 }] })
        .mockResolvedValueOnce({
          rows: [{ id: 10, prescription_id: 5, medicine_id: 3 }],
        });

      const result = await service.createPrescriptionItem(itemDto, 1);

      expect(result.id).toBe(10);
    });
  });
});
