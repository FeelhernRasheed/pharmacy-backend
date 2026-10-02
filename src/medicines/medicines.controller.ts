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

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { MedicinesService } from './medicines.service';

@Controller('medicines')
@UseGuards(JwtAuthGuard)
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