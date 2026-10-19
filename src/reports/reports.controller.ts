
import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import {ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
  ) {}

  @ApiOperation({ summary: 'Sales report' })
  @Get('sales')
  getSalesReport() {
    return this.reportsService.getSalesReport();
  }

  @ApiOperation({ summary: 'Inventory value report' })
  @Get('inventory')
  getInventoryReport() {
    return this.reportsService.getInventoryReport();
  }

  @ApiOperation({ summary: 'Expiry report by status' })
  @Get('expiry')
  getExpiryReport() {
    return this.reportsService.getExpiryReport();
  }

  @ApiOperation({ summary: 'Purchases report' })
  @Get('purchases')
  getPurchasesReport() {
    return this.reportsService.getPurchasesReport();
  }

  @ApiOperation({ summary: 'Payments report' })
  @Get('payments')
  getPaymentsReport() {
    return this.reportsService.getPaymentsReport();
  }
}
