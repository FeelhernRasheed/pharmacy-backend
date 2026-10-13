import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { MedicinesService } from './medicines.service';

@ApiTags('Medicines')
@ApiBearerAuth()
@Controller('medicines')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MedicinesController {
  constructor(
    private readonly medicinesService: MedicinesService,
  ) {}

  @Get()
  getMedicines() {
    return this.medicinesService.getMedicines();
  }

  @Get(':id')
  getMedicineById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.medicinesService.getMedicineById(id);
  }

  @Post()
  @Roles('ADMIN', 'PHARMACIST')
  createMedicine(
    @Body() createMedicineDto: CreateMedicineDto,
    @Request() request: any,
  ) {
    return this.medicinesService.createMedicine(
      createMedicineDto,
      request.user.userId,
    );
  }

  @Put(':id')
  @Roles('ADMIN', 'PHARMACIST')
  updateMedicine(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMedicineDto: UpdateMedicineDto,
    @Request() request: any,
  ) {
    return this.medicinesService.updateMedicine(
      id,
      updateMedicineDto,
      request.user.userId,
    );
  }

  @Delete(':id')
  @Roles('ADMIN', 'PHARMACIST')
  deleteMedicine(
    @Param('id', ParseIntPipe) id: number,
    @Request() request: any,
  ) {
    return this.medicinesService.deleteMedicine(
      id,
      request.user.userId,
    );
  }
}