import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../database/database.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { StockAdjustmentsService } from './stock-adjustments.service';

describe('StockAdjustmentsService', () => {
  let service: StockAdjustmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
    StockAdjustmentsService,
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

    service = module.get<StockAdjustmentsService>(StockAdjustmentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
