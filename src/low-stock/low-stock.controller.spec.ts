import { Test, TestingModule } from '@nestjs/testing';
import { LowStockController } from './low-stock.controller';
import { LowStockService } from './low-stock.service';

describe('LowStockController', () => {
  let controller: LowStockController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LowStockController],
      providers: [
        {
          provide: LowStockService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<LowStockController>(LowStockController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
