import { Module } from '@nestjs/common';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { PurchaseItemsController } from './purchase-items.controller';
import { PurchaseItemsService } from './purchase-items.service';

@Module({
  controllers: [
    PurchasesController,
    PurchaseItemsController,
  ],
  providers: [
    PurchasesService,
    PurchaseItemsService,
  ],
})
export class PurchasesModule {}