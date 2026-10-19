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
import {ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import { StockAdjustmentsService } from './stock-adjustments.service';

@ApiTags('Stock Adjustments')
@ApiBearerAuth('bearer')
@Controller('stock-adjustments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StockAdjustmentsController {
  constructor(
    private readonly stockAdjustmentsService: StockAdjustmentsService,
  ) {}

  @ApiOperation({ summary: 'List stock adjustments' })
  @Get()
  getStockAdjustments() {
    return this.stockAdjustmentsService.getStockAdjustments();
  }

  @ApiOperation({ summary: 'Get stock adjustment by ID' })
  @Get(':id')
  getStockAdjustmentById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.stockAdjustmentsService.getStockAdjustmentById(id);
  }

  @ApiOperation({ summary: 'Record stock adjustment (damage/expiry/loss)' })
  @Post()
  @Roles('ADMIN', 'PHARMACIST')
  createStockAdjustment(
    @Body() createStockAdjustmentDto: CreateStockAdjustmentDto,
    @Req() req: any,
  ) {
    return this.stockAdjustmentsService.createStockAdjustment(
      createStockAdjustmentDto,
      req.user.userId,
    );
  }
}