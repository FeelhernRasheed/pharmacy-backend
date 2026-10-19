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

import { CreateSaleItemDto } from './dto/create-sale-item.dto';
import { SaleItemsService } from './sale-items.service';

@ApiTags('Sale Items')
@ApiBearerAuth('bearer')
@Controller('sale-items')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SaleItemsController {
  constructor(
    private readonly saleItemsService: SaleItemsService,
  ) {}

  @ApiOperation({ summary: 'List sale items' })
  @Get('sale/:saleId')
  getSaleItems(
    @Param('saleId', ParseIntPipe) saleId: number,
  ) {
    return this.saleItemsService.getSaleItems(saleId);
  }

  @ApiOperation({ summary: 'Add item to a sale (deducts stock)' })
  @Post()
  @Roles('ADMIN', 'PHARMACIST', 'CASHIER')
  createSaleItem(
    @Body() createSaleItemDto: CreateSaleItemDto,
    @Req() req: any,
  ) {
    return this.saleItemsService.createSaleItem(
      createSaleItemDto,
      req.user.userId,
    );
  }
}