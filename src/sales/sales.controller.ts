
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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

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
  @Roles('ADMIN', 'PHARMACIST', 'CASHIER')
  createSale(
    @Body() createSaleDto: CreateSaleDto,
    @Req() req: any,
  ) {
    return this.salesService.createSale(
      createSaleDto,
      req.user.userId,
    );
  }

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
