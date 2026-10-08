import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { LowStockService } from './low-stock.service';

@Controller('low-stock')
@UseGuards(JwtAuthGuard)
export class LowStockController {
  constructor(
    private readonly lowStockService: LowStockService,
  ) {}

  @Get()
  getLowStock(
    @Query('threshold') threshold?: string,
  ) {
    const stockThreshold = threshold
      ? Number(threshold)
      : 20;

    return this.lowStockService.getLowStock(
      stockThreshold,
    );
  }
}