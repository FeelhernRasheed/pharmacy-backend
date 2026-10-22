import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
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

import { CreateSaleItemDto } from './dto/create-sale-item.dto';
import { SaleItemsService } from './sale-items.service';

@ApiTags('Sale Items')
@ApiBearerAuth('bearer')
@Controller('sale-items')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SaleItemsController {
  constructor(
    private readonly saleItemsService: SaleItemsService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @ApiOperation({ summary: 'List sale items' })
  @Get('sale/:saleId')
  getSaleItems(
    @Param('saleId', ParseIntPipe) saleId: number,
  ) {
    return this.saleItemsService.getSaleItems(saleId);
  }

  @ApiOperation({
    summary: 'Add item to a sale (deducts stock)',
    description:
      'The unit price is taken from the medicine batch on the server, a price sent in the body is ignored. Send an Idempotency-Key header to make the request safe to retry. The key is bound to the request payload, a key that is reused with a different payload is rejected.',
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
  async createSaleItem(
    @Body() createSaleItemDto: CreateSaleItemDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const key = resolveIdempotencyKey(req);

    if (!key) {
      return this.saleItemsService.createSaleItem(
        createSaleItemDto,
        req.user.userId,
      );
    }

    const outcome = await this.idempotencyService.run({
      endpoint: 'POST /sale-items',
      method: req.method,
      key,
      payload: createSaleItemDto,
      handler: (client) =>
        this.saleItemsService.createSaleItem(
          createSaleItemDto,
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
