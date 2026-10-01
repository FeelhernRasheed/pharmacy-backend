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
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PatientsService } from './patients.service';

@Controller('patients')
export class PatientsController {
  constructor(
    private readonly patientsService: PatientsService,
  ) {}

  @Get()
  getPatients() {
    return this.patientsService.getPatients();
  }

  @Get(':id')
  getPatientById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.patientsService.getPatientById(id);
  }

  @Post()
  createPatient(
    @Body() createPatientDto: CreatePatientDto,
  ) {
    return this.patientsService.createPatient(
      createPatientDto,
    );
  }

  @Put(':id')
  updatePatient(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePatientDto: UpdatePatientDto,
  ) {
    return this.patientsService.updatePatient(
      id,
      updatePatientDto,
    );
  }

  @Delete(':id')
  deletePatient(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.patientsService.deletePatient(id);
  }
}