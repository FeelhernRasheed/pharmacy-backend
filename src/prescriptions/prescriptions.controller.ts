import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { CreatePrescriptionItemDto } from './dto/create-prescription-item.dto';
import { PrescriptionsService } from './prescriptions.service';

@Controller('prescriptions')
@UseGuards(JwtAuthGuard)
export class PrescriptionsController {
  constructor(
    private readonly prescriptionsService: PrescriptionsService,
  ) {}

  @Get()
  getPrescriptions() {
    return this.prescriptionsService.getPrescriptions();
  }

  @Get(':id')
  getPrescriptionById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.prescriptionsService.getPrescriptionById(id);
  }

  @Post()
  createPrescription(
    @Body() createPrescriptionDto: CreatePrescriptionDto,
  ) {
    return this.prescriptionsService.createPrescription(
      createPrescriptionDto,
    );
  }

  @Post('items')
  createPrescriptionItem(
    @Body()
    createPrescriptionItemDto: CreatePrescriptionItemDto,
  ) {
    return this.prescriptionsService.createPrescriptionItem(
      createPrescriptionItemDto,
    );
  }
}