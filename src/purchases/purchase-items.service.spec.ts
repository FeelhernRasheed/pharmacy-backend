import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../database/database.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PurchaseItemsService } from './purchase-items.service';

describe('PurchaseItemsService', () => {
  let service: PurchaseItemsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
    PurchaseItemsService,
    {
      provide: DatabaseService,
      useValue: {
        getPool: jest.fn(),
        testConnection: jest.fn(),
      },
    },
    {
      provide: AuditLogsService,
      useValue: {
        createAuditLog: jest.fn(),
      },
    },
      ],
    }).compile();

    service = module.get<PurchaseItemsService>(PurchaseItemsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
