
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
import {ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SuppliersService } from './suppliers.service';

@ApiTags('Suppliers')
@ApiBearerAuth('bearer')
@Controller('suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SuppliersController {
  constructor(
    private readonly suppliersService: SuppliersService,
  ) {}

  @ApiOperation({ summary: 'List suppliers' })
  @Get()
  getSuppliers() {
    return this.suppliersService.getSuppliers();
  }

  @ApiOperation({ summary: 'Get supplier by ID' })
  @Get(':id')
  getSupplierById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.suppliersService.getSupplierById(id);
  }

  @ApiOperation({ summary: 'Create supplier' })
  @Post()
  @Roles('ADMIN', 'PHARMACIST')
  createSupplier(
    @Body() createSupplierDto: CreateSupplierDto,
    @Req() req: any,
  ) {
    return this.suppliersService.createSupplier(
      createSupplierDto,
      req.user.userId,
    );
  }

  @ApiOperation({ summary: 'Update supplier' })
  @Put(':id')
  @Roles('ADMIN', 'PHARMACIST')
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

  @ApiOperation({ summary: 'Delete supplier' })
  @Delete(':id')
  @Roles('ADMIN', 'PHARMACIST')
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
