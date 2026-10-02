import { Test, TestingModule } from '@nestjs/testing';
import { ExpiryManagementController } from './expiry-management.controller';

describe('ExpiryManagementController', () => {
  let controller: ExpiryManagementController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpiryManagementController],
    }).compile();

    controller = module.get<ExpiryManagementController>(ExpiryManagementController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
