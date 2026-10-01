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
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SuppliersService } from './suppliers.service';

@Controller('suppliers')
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
  ) {
    return this.suppliersService.createSupplier(
      createSupplierDto,
    );
  }

  @Put(':id')
  updateSupplier(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSupplierDto: UpdateSupplierDto,
  ) {
    return this.suppliersService.updateSupplier(
      id,
      updateSupplierDto,
    );
  }

  @Delete(':id')
  deleteSupplier(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.suppliersService.deleteSupplier(id);
  }
}