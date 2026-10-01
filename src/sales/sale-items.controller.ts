import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { CreateSaleItemDto } from './dto/create-sale-item.dto';
import { SaleItemsService } from './sale-items.service';

@Controller('sale-items')
export class SaleItemsController {
  constructor(
    private readonly saleItemsService: SaleItemsService,
  ) {}

  @Get('sale/:saleId')
  getSaleItems(
    @Param('saleId', ParseIntPipe) saleId: number,
  ) {
    return this.saleItemsService.getSaleItems(saleId);
  }

  @Post()
  createSaleItem(
    @Body() createSaleItemDto: CreateSaleItemDto,
  ) {
    return this.saleItemsService.createSaleItem(
      createSaleItemDto,
    );
  }
}