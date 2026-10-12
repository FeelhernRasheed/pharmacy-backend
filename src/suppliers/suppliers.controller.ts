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

import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SuppliersService } from './suppliers.service';

@Controller('suppliers')
@UseGuards(JwtAuthGuard)
export class SuppliersController {
  constructor(
    private readonly suppliersService: SuppliersService,
  ) {}

  @Get()
  getSuppliers() {
    return this.suppliersService.getSuppliers();
  }

  @Get(':id')
  getSupplierById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.suppliersService.getSupplierById(id);
  }

  @Post()
  createSupplier(
    @Body() createSupplierDto: CreateSupplierDto,
    @Req() req: any,
  ) {
    return this.suppliersService.createSupplier(
      createSupplierDto,
      req.user.userId,
    );
  }

  @Put(':id')
  updateSupplier(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSupplierDto: UpdateSupplierDto,
    @Req() req: any,
  ) {
    return this.suppliersService.updateSupplier(
      id,
      updateSupplierDto,
      req.user.userId,
    );
  }

  @Delete(':id')
  deleteSupplier(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    return this.suppliersService.deleteSupplier(
      id,
      req.user.userId,
    );
  }
}