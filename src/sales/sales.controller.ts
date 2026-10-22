
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
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

import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { SalesService } from './sales.service';

@ApiTags('Sales')
@ApiBearerAuth('bearer')
@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @ApiOperation({ summary: 'List sales' })
  @Get()
  getSales() {
    return this.salesService.getSales();
  }

  @ApiOperation({ summary: 'Get sale by ID' })
  @Get(':id')
  getSaleById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.salesService.getSaleById(id);
  }

  @ApiOperation({
    summary: 'Create sale',
    description:
      'Send an Idempotency-Key header to make the request safe to retry: a repeated request replays the original response instead of creating a second sale. The key is bound to the request payload, a key that is reused with a different payload is rejected.',
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
  async createSale(
    @Body() createSaleDto: CreateSaleDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const key = resolveIdempotencyKey(req);

    if (!key) {
      return this.salesService.createSale(
        createSaleDto,
        req.user.userId,
      );
    }

    const outcome = await this.idempotencyService.run({
      endpoint: 'POST /sales',
      method: req.method,
      key,
      payload: createSaleDto,
      handler: (client) =>
        this.salesService.createSale(
          createSaleDto,
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

  @ApiOperation({ summary: 'Update sale status (cancel restores stock)' })
  @Put(':id')
  @Roles('ADMIN', 'PHARMACIST')
  updateSale(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSaleDto: UpdateSaleDto,
    @Req() req: any,
  ) {
    return this.salesService.updateSale(
      id,
      updateSaleDto.status,
      req.user.userId,
    );
  }

  @ApiOperation({ summary: 'Delete sale' })
  @Delete(':id')
  @Roles('ADMIN')
  deleteSale(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    return this.salesService.deleteSale(
      id,
      req.user.userId,
    );
  }
}
