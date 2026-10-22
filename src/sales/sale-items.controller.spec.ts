import { Test, TestingModule } from '@nestjs/testing';

import { IdempotencyService } from '../common/idempotency/idempotency.service';

import { SaleItemsController } from './sale-items.controller';
import { SaleItemsService } from './sale-items.service';

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

describe('SaleItemsController', () => {
  let controller: SaleItemsController;
  let saleItemsService: { createSaleItem: jest.Mock };
  let idempotencyService: { run: jest.Mock };

  beforeEach(async () => {
    saleItemsService = {
      createSaleItem: jest.fn().mockResolvedValue({ id: 5 }),
    };
    idempotencyService = {
      run: jest
        .fn()
        .mockResolvedValue({ replayed: false, statusCode: 201, result: { id: 5 } }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SaleItemsController],
      providers: [
        {
          provide: SaleItemsService,
          useValue: saleItemsService,
        },
        {
          provide: IdempotencyService,
          useValue: idempotencyService,
        },
      ],
    }).compile();

    controller = module.get<SaleItemsController>(SaleItemsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('binds the key to the validated payload', async () => {
    const dto = { sale_id: 1, batch_id: 2, quantity: 3 };
    const request = buildRequest({ 'Idempotency-Key': 'sale-item-key-1' });

    await controller.createSaleItem(dto, request, buildResponse());

    const call = idempotencyService.run.mock.calls[0][0];

    expect(call.endpoint).toBe('POST /sale-items');
    expect(call.method).toBe('POST');
    expect(call.key).toBe('sale-item-key-1');
    expect(call.payload).toBe(dto);
  });

  it('runs the sale item inside the idempotency transaction', async () => {
    const dto = { sale_id: 1, batch_id: 2, quantity: 3 };
    const request = buildRequest({ 'Idempotency-Key': 'sale-item-key-1' });
    const client = { query: jest.fn() };

    await controller.createSaleItem(dto, request, buildResponse());

    const call = idempotencyService.run.mock.calls[0][0];

    await call.handler(client);

    expect(saleItemsService.createSaleItem).toHaveBeenCalledWith(
      dto,
      7,
      client,
    );
  });

  it('executes the sale item without a key', async () => {
    const dto = { sale_id: 1, batch_id: 2, quantity: 3 };

    await controller.createSaleItem(dto, buildRequest({}), buildResponse());

    expect(idempotencyService.run).not.toHaveBeenCalled();
    expect(saleItemsService.createSaleItem).toHaveBeenCalledWith(dto, 7);
  });
});
