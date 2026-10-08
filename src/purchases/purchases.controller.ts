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

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { PurchasesService } from './purchases.service';

@Controller('purchases')
@UseGuards(JwtAuthGuard)
export class PurchasesController {
  constructor(
    private readonly purchasesService: PurchasesService,
  ) {}

  @Get()
  getPurchases() {
    return this.purchasesService.getPurchases();
  }

  @Get(':id')
  getPurchaseById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.purchasesService.getPurchaseById(id);
  }

  @Post()
  createPurchase(
    @Body() createPurchaseDto: CreatePurchaseDto,
    @Req() req: any,
  ) {
    return this.purchasesService.createPurchase(
      createPurchaseDto,
      req.user.userId,
    );
  }

  @Put(':id')
  updatePurchase(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePurchaseDto: UpdatePurchaseDto,
    @Req() req: any,
  ) {
    return this.purchasesService.updatePurchase(
      id,
      updatePurchaseDto,
      req.user.userId,
    );
  }

  @Delete(':id')
  deletePurchase(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    return this.purchasesService.deletePurchase(
      id,
      req.user.userId,
    );
  }
}