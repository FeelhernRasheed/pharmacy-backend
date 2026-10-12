
import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
  ) {}

  @Get('sales')
  getSalesReport() {
    return this.reportsService.getSalesReport();
  }

  @Get('inventory')
  getInventoryReport() {
    return this.reportsService.getInventoryReport();
  }

  @Get('expiry')
  getExpiryReport() {
    return this.reportsService.getExpiryReport();
  }

  @Get('purchases')
  getPurchasesReport() {
    return this.reportsService.getPurchasesReport();
  }

  @Get('payments')
  getPaymentsReport() {
    return this.reportsService.getPaymentsReport();
  }
}
