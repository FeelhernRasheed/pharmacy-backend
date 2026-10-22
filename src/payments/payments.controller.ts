
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiResponse,
  ApiTags,
  ApiOperation,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { resolveIdempotencyKey } from '../common/idempotency/idempotency-key';
import { IdempotencyService } from '../common/idempotency/idempotency.service';

import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@ApiBearerAuth('bearer')
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @ApiOperation({ summary: 'List payments' })
  @Get()
  getPayments() {
    return this.paymentsService.getPayments();
  }

  @ApiOperation({ summary: 'List payments by status' })
  @Get('status')
  getPaymentsByStatus(
    @Query('status') status: string,
  ) {
    return this.paymentsService.getPaymentsByStatus(
      status,
    );
  }

  @ApiOperation({ summary: 'List payments for a sale' })
  @Get('sale/:saleId')
  getPaymentsBySaleId(
    @Param('saleId', ParseIntPipe) saleId: number,
  ) {
    return this.paymentsService.getPaymentsBySaleId(saleId);
  }

  @ApiOperation({ summary: 'Get payment by ID' })
  @Get(':id')
  getPaymentById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.paymentsService.getPaymentById(id);
  }

  @ApiOperation({
    summary: 'Record payment for a sale',
    description:
      'Send an Idempotency-Key header to make the request safe to retry: a repeated request replays the original response instead of recording the payment twice. The key is bound to the request payload, a key that is reused with a different payload is rejected.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'Client generated key (8-128 characters) that identifies this request. The same key with the same payload replays the stored response, the same key with a different payload is answered with 409 Conflict. A request without this header is executed without idempotency protection. The X-Request-Id header is a correlation id and is never used as an idempotency key.',
  })
  @ApiResponse({
    status: 409,
    description:
      'The Idempotency-Key was already used for a different request, or a request with that key is still in progress.',
  })
  @Post()
  @Roles('ADMIN', 'PHARMACIST', 'CASHIER')
  async createPayment(
    @Body() createPaymentDto: CreatePaymentDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const key = resolveIdempotencyKey(req);

    if (!key) {
      return this.paymentsService.createPayment(
        createPaymentDto,
        req.user.userId,
      );
    }

    const outcome = await this.idempotencyService.run({
      endpoint: 'POST /payments',
      method: req.method,
      key,
      payload: createPaymentDto,
      handler: (client) =>
        this.paymentsService.createPayment(
          createPaymentDto,
          req.user.userId,
          client,
        ),
    });

    res.status(outcome.statusCode);

    if (outcome.replayed) {
      res.setHeader('Idempotency-Replayed', 'true');
    }

    return outcome.result;
  }
}
