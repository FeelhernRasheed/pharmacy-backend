
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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { PurchasesService } from './purchases.service';

@ApiTags('Purchases')
@ApiBearerAuth('bearer')
@Controller('purchases')
@UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles('ADMIN', 'PHARMACIST')
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
  @Roles('ADMIN', 'PHARMACIST')
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
  @Roles('ADMIN', 'PHARMACIST')
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
