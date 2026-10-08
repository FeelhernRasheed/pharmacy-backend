import { Test, TestingModule } from '@nestjs/testing';
import { LowStockService } from './low-stock.service';

describe('LowStockService', () => {
  let service: LowStockService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LowStockService],
    }).compile();

    service = module.get<LowStockService>(LowStockService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
