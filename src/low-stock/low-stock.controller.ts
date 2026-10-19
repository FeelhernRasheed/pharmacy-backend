import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { LowStockService } from './low-stock.service';

@ApiTags('Low Stock')
@ApiBearerAuth('bearer')
@Controller('low-stock')
@UseGuards(JwtAuthGuard)
export class LowStockController {
  constructor(
    private readonly lowStockService: LowStockService,
  ) {}

  @ApiOperation({ summary: 'List low stock batches' })
  @Get()
  getLowStock(
    @Query('threshold') threshold?: string,
  ) {
    let stockThreshold = 20;

    if (threshold !== undefined) {
      stockThreshold = Number(threshold);

      if (
        !Number.isInteger(stockThreshold) ||
        stockThreshold < 0
      ) {
        throw new BadRequestException(
          'threshold must be a non-negative integer',
        );
      }
    }

    return this.lowStockService.getLowStock(
      stockThreshold,
    );
  }
}