
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

import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PatientsService } from './patients.service';

@ApiTags('Patients')
@ApiBearerAuth('bearer')
@Controller('patients')
@UseGuards(JwtAuthGuard)
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
    @Req() req: any,
  ) {
    return this.patientsService.createPatient(
      createPatientDto,
      req.user.userId,
    );
  }

  @Put(':id')
  updatePatient(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePatientDto: UpdatePatientDto,
    @Req() req: any,
  ) {
    return this.patientsService.updatePatient(
      id,
      updatePatientDto,
      req.user.userId,
    );
  }

  @Delete(':id')
  deletePatient(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    return this.patientsService.deletePatient(
      id,
      req.user.userId,
    );
  }
}
