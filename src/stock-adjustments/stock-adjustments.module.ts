import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';

import { StockAdjustmentsController } from './stock-adjustments.controller';
import { StockAdjustmentsService } from './stock-adjustments.service';

@Module({
  imports: [
    AuditLogsModule,
  ],
  controllers: [
    StockAdjustmentsController,
  ],
  providers: [
    StockAdjustmentsService,
  ],
})
export class StockAdjustmentsModule {}