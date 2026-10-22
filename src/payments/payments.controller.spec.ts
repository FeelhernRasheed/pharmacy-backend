import { Test, TestingModule } from '@nestjs/testing';

import { IdempotencyService } from '../common/idempotency/idempotency.service';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

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

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let paymentsService: { createPayment: jest.Mock };
  let idempotencyService: { run: jest.Mock };

  beforeEach(async () => {
    paymentsService = { createPayment: jest.fn().mockResolvedValue({ id: 3 }) };
    idempotencyService = {
      run: jest
        .fn()
        .mockResolvedValue({ replayed: false, statusCode: 201, result: { id: 3 } }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: paymentsService,
        },
        {
          provide: IdempotencyService,
          useValue: idempotencyService,
        },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('binds the key to the validated payload', async () => {
    const dto = { sale_id: 1, amount: 25.5, payment_method: 'CASH' };
    const request = buildRequest({ 'Idempotency-Key': 'payment-key-123' });
    const response = buildResponse();

    await controller.createPayment(dto, request, response);

    expect(idempotencyService.run).toHaveBeenCalledTimes(1);

    const call = idempotencyService.run.mock.calls[0][0];

    expect(call.endpoint).toBe('POST /payments');
    expect(call.method).toBe('POST');
    expect(call.key).toBe('payment-key-123');
    expect(call.payload).toBe(dto);
  });

  it('runs the payment inside the idempotency transaction', async () => {
    const dto = { sale_id: 1, amount: 25.5, payment_method: 'CASH' };
    const request = buildRequest({ 'Idempotency-Key': 'payment-key-123' });
    const response = buildResponse();
    const client = { query: jest.fn() };

    await controller.createPayment(dto, request, response);

    const call = idempotencyService.run.mock.calls[0][0];

    await call.handler(client);

    expect(paymentsService.createPayment).toHaveBeenCalledWith(dto, 7, client);
  });

  it('marks a replayed response', async () => {
    idempotencyService.run.mockResolvedValue({
      replayed: true,
      statusCode: 201,
      result: { id: 3 },
    });

    const request = buildRequest({ 'Idempotency-Key': 'payment-key-123' });
    const response = buildResponse();

    await controller.createPayment(
      { sale_id: 1, amount: 25.5, payment_method: 'CASH' },
      request,
      response,
    );

    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.setHeader).toHaveBeenCalledWith(
      'Idempotency-Replayed',
      'true',
    );
  });

  it('executes the payment without a key', async () => {
    const dto = { sale_id: 1, amount: 25.5, payment_method: 'CASH' };
    const request = buildRequest({});
    const response = buildResponse();

    await controller.createPayment(dto, request, response);

    expect(idempotencyService.run).not.toHaveBeenCalled();
    expect(paymentsService.createPayment).toHaveBeenCalledWith(dto, 7);
  });

  it('does not use X-Request-Id as an idempotency key', async () => {
    const request = buildRequest({ 'X-Request-Id': 'request-12345678' });
    const response = buildResponse();

    await controller.createPayment(
      { sale_id: 1, amount: 25.5, payment_method: 'CASH' },
      request,
      response,
    );

    expect(idempotencyService.run).not.toHaveBeenCalled();
    expect(paymentsService.createPayment).toHaveBeenCalledTimes(1);
  });
});
