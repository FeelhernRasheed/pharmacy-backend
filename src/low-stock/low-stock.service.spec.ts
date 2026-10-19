import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../database/database.service';
import { LowStockService } from './low-stock.service';

describe('LowStockService', () => {
  let service: LowStockService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
    LowStockService,
    {
      provide: DatabaseService,
      useValue: {
        getPool: jest.fn(),
        testConnection: jest.fn(),
      },
    },
      ],
    }).compile();

    service = module.get<LowStockService>(LowStockService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
