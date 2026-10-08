import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';

import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

import { SaleItemsController } from './sale-items.controller';
import { SaleItemsService } from './sale-items.service';

@Module({
  imports: [
    AuditLogsModule,
  ],
  controllers: [
    SalesController,
    SaleItemsController,
  ],
  providers: [
    SalesService,
    SaleItemsService,
  ],
})
export class SalesModule {}