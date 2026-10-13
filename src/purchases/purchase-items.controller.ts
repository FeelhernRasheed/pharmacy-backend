
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreatePurchaseItemDto } from './dto/create-purchase-item.dto';
import { PurchaseItemsService } from './purchase-items.service';

@ApiTags('Purchase Items')
@ApiBearerAuth('bearer')
@Controller('purchase-items')
@UseGuards(JwtAuthGuard)
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
    @Req() req: any,
  ) {
    return this.purchaseItemsService.createPurchaseItem(
      createPurchaseItemDto,
      req.user.userId,
    );
  }
}