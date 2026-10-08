import { Module } from '@nestjs/common';

import { LowStockController } from './low-stock.controller';
import { LowStockService } from './low-stock.service';

@Module({
  controllers: [LowStockController],
  providers: [LowStockService],
})
export class LowStockModule {}