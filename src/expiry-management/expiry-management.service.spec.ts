import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../database/database.service';
import { ExpiryManagementService } from './expiry-management.service';

describe('ExpiryManagementService', () => {
  let service: ExpiryManagementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
    ExpiryManagementService,
    {
      provide: DatabaseService,
      useValue: {
        getPool: jest.fn(),
        testConnection: jest.fn(),
      },
    },
      ],
    }).compile();

    service = module.get<ExpiryManagementService>(ExpiryManagementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
