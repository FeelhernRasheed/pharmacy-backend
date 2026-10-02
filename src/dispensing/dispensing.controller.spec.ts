import { Test, TestingModule } from '@nestjs/testing';
import { DispensingController } from './dispensing.controller';

describe('DispensingController', () => {
  let controller: DispensingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DispensingController],
    }).compile();

    controller = module.get<DispensingController>(DispensingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
