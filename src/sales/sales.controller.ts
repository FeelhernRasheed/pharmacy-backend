import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SalesService } from './sales.service';

@Controller('sales')
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
  ) {}

  @Get()
  getSales() {
    return this.salesService.getSales();
  }

  @Get(':id')
  getSaleById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.salesService.getSaleById(id);
  }

  @Post()
  createSale(
    @Body() createSaleDto: CreateSaleDto,
  ) {
    return this.salesService.createSale(
      createSaleDto,
    );
  }
}