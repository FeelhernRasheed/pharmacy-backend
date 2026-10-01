import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { PurchasesService } from './purchases.service';

@Controller('purchases')
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
  ) {
    return this.purchasesService.createPurchase(
      createPurchaseDto,
    );
  }

  @Put(':id')
  updatePurchase(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePurchaseDto: UpdatePurchaseDto,
  ) {
    return this.purchasesService.updatePurchase(
      id,
      updatePurchaseDto,
    );
  }

  @Delete(':id')
  deletePurchase(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.purchasesService.deletePurchase(id);
  }
}