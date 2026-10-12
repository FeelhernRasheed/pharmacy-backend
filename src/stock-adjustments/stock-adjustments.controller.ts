import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import { StockAdjustmentsService } from './stock-adjustments.service';

@Controller('stock-adjustments')
@UseGuards(JwtAuthGuard)
export class StockAdjustmentsController {
  constructor(
    private readonly stockAdjustmentsService: StockAdjustmentsService,
  ) {}

  @Get()
  getStockAdjustments() {
    return this.stockAdjustmentsService.getStockAdjustments();
  }

  @Get(':id')
  getStockAdjustmentById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.stockAdjustmentsService.getStockAdjustmentById(
      id,
    );
  }

  @Post()
  createStockAdjustment(
    @Body()
    createStockAdjustmentDto: CreateStockAdjustmentDto,
    @Req() req: any,
  ) {
    return this.stockAdjustmentsService.createStockAdjustment(
      createStockAdjustmentDto,
      req.user.userId,
    );
  }
}