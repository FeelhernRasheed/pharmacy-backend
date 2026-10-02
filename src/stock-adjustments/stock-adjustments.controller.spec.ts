import { Test, TestingModule } from '@nestjs/testing';
import { StockAdjustmentsController } from './stock-adjustments.controller';

describe('StockAdjustmentsController', () => {
  let controller: StockAdjustmentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockAdjustmentsController],
    }).compile();

    controller = module.get<StockAdjustmentsController>(StockAdjustmentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
