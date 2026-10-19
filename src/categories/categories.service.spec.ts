import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../database/database.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  let service: CategoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
    CategoriesService,
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

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
