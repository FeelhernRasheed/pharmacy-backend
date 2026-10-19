
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
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { CreatePurchaseItemDto } from './dto/create-purchase-item.dto';
import { PurchaseItemsService } from './purchase-items.service';

@ApiTags('Purchase Items')
@ApiBearerAuth('bearer')
@Controller('purchase-items')
@UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles('ADMIN', 'PHARMACIST')
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