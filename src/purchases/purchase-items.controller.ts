import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Body,
} from '@nestjs/common';
import { CreatePurchaseItemDto } from './dto/create-purchase-item.dto';
import { PurchaseItemsService } from './purchase-items.service';

@Controller('purchase-items')
export class PurchaseItemsController {
  constructor(
    private readonly purchaseItemsService: PurchaseItemsService,
  ) {}

  @Get('purchase/:purchaseId')
  getPurchaseItems(
    @Param('purchaseId', ParseIntPipe) purchaseId: number,
  ) {
    return this.purchaseItemsService.getPurchaseItems(
      purchaseId,
    );
  }

  @Post()
  createPurchaseItem(
    @Body() createPurchaseItemDto: CreatePurchaseItemDto,
  ) {
    return this.purchaseItemsService.createPurchaseItem(
      createPurchaseItemDto,
    );
  }
}