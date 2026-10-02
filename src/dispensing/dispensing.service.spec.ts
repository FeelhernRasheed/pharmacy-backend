import { Test, TestingModule } from '@nestjs/testing';
import { DispensingService } from './dispensing.service';

describe('DispensingService', () => {
  let service: DispensingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DispensingService],
    }).compile();

    service = module.get<DispensingService>(DispensingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
