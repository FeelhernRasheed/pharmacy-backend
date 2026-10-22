import { Test, TestingModule } from '@nestjs/testing';

import { IdempotencyService } from '../common/idempotency/idempotency.service';

import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

function buildRequest(headers: Record<string, string>): any {
  return {
    method: 'POST',
    user: { userId: 7 },
    header: (name: string) => headers[name],
  };
}

function buildResponse(): any {
  return {
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
}

describe('SalesController', () => {
  let controller: SalesController;
  let salesService: { createSale: jest.Mock };
  let idempotencyService: { run: jest.Mock };

  beforeEach(async () => {
    salesService = { createSale: jest.fn().mockResolvedValue({ id: 9 }) };
    idempotencyService = {
      run: jest
        .fn()
        .mockResolvedValue({ replayed: false, statusCode: 201, result: { id: 9 } }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SalesController],
      providers: [
        {
          provide: SalesService,
          useValue: salesService,
        },
        {
          provide: IdempotencyService,
          useValue: idempotencyService,
        },
      ],
    }).compile();

    controller = module.get<SalesController>(SalesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('binds the key to the validated payload', async () => {
    const dto = { patient_id: 1 };
    const request = buildRequest({ 'Idempotency-Key': 'sale-key-123456' });

    await controller.createSale(dto, request, buildResponse());

    const call = idempotencyService.run.mock.calls[0][0];

    expect(call.endpoint).toBe('POST /sales');
    expect(call.method).toBe('POST');
    expect(call.key).toBe('sale-key-123456');
    expect(call.payload).toBe(dto);
  });

  it('runs the sale inside the idempotency transaction', async () => {
    const dto = { patient_id: 1 };
    const request = buildRequest({ 'Idempotency-Key': 'sale-key-123456' });
    const client = { query: jest.fn() };

    await controller.createSale(dto, request, buildResponse());

    const call = idempotencyService.run.mock.calls[0][0];

    await call.handler(client);

    expect(salesService.createSale).toHaveBeenCalledWith(dto, 7, client);
  });

  it('executes the sale without a key', async () => {
    const dto = { patient_id: 1 };

    await controller.createSale(dto, buildRequest({}), buildResponse());

    expect(idempotencyService.run).not.toHaveBeenCalled();
    expect(salesService.createSale).toHaveBeenCalledWith(dto, 7);
  });
});
