
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

import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PatientsService } from './patients.service';

@ApiTags('Patients')
@ApiBearerAuth('bearer')
@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles('ADMIN', 'PHARMACIST', 'CASHIER')
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
  @Roles('ADMIN', 'PHARMACIST', 'CASHIER')
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
  @Roles('ADMIN')
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
