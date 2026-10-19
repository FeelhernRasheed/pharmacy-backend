import { Test, TestingModule } from '@nestjs/testing';
import { ExpiryManagementController } from './expiry-management.controller';
import { ExpiryManagementService } from './expiry-management.service';

describe('ExpiryManagementController', () => {
  let controller: ExpiryManagementController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpiryManagementController],
      providers: [
        {
          provide: ExpiryManagementService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<ExpiryManagementController>(ExpiryManagementController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
