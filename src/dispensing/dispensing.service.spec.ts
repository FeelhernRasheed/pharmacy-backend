import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../database/database.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DispensingService } from './dispensing.service';

describe('DispensingService', () => {
  let service: DispensingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
    DispensingService,
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

    service = module.get<DispensingService>(DispensingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
