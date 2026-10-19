
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
import {ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

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

  @ApiOperation({ summary: 'Create sale' })
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
