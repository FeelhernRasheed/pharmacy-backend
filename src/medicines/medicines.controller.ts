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
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { MedicinesService } from './medicines.service';

@Controller('medicines')
export class MedicinesController {
  constructor(private readonly medicinesService: MedicinesService) {}

  @Get()
  getMedicines() {
    return this.medicinesService.getMedicines();
  }

  @Get(':id')
  getMedicineById(@Param('id', ParseIntPipe) id: number) {
    return this.medicinesService.getMedicineById(id);
  }

  @Post()
  createMedicine(@Body() createMedicineDto: CreateMedicineDto) {
    return this.medicinesService.createMedicine(createMedicineDto);
  }

  @Put(':id')
  updateMedicine(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMedicineDto: UpdateMedicineDto,
  ) {
    return this.medicinesService.updateMedicine(id, updateMedicineDto);
  }

  @Delete(':id')
  deleteMedicine(@Param('id', ParseIntPipe) id: number) {
    return this.medicinesService.deleteMedicine(id);
  }
}