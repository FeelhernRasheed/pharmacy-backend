import { Test, TestingModule } from '@nestjs/testing';
import { ExpiryManagementService } from './expiry-management.service';

describe('ExpiryManagementService', () => {
  let service: ExpiryManagementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExpiryManagementService],
    }).compile();

    service = module.get<ExpiryManagementService>(ExpiryManagementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
