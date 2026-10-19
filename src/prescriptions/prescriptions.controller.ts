import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { CreatePrescriptionItemDto } from './dto/create-prescription-item.dto';
import { PrescriptionsService } from './prescriptions.service';

@ApiTags('Prescriptions')
@ApiBearerAuth('bearer')
@Controller('prescriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrescriptionsController {
  constructor(
    private readonly prescriptionsService: PrescriptionsService,
  ) {}

  @ApiOperation({ summary: 'List prescriptions' })
  @Get()
  getPrescriptions() {
    return this.prescriptionsService.getPrescriptions();
  }

  @ApiOperation({ summary: 'Get prescription by ID' })
  @Get(':id')
  getPrescriptionById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.prescriptionsService.getPrescriptionById(id);
  }

  @ApiOperation({ summary: 'Create prescription' })
  @Post()
  @Roles('ADMIN', 'PHARMACIST')
  createPrescription(
    @Body() createPrescriptionDto: CreatePrescriptionDto,
    @Req() req: any,
  ) {
    return this.prescriptionsService.createPrescription(
      createPrescriptionDto,
      req.user.userId,
    );
  }

  @ApiOperation({ summary: 'Add item to a prescription' })
  @Post('items')
  @Roles('ADMIN', 'PHARMACIST')
  createPrescriptionItem(
    @Body() createPrescriptionItemDto: CreatePrescriptionItemDto,
    @Req() req: any,
  ) {
    return this.prescriptionsService.createPrescriptionItem(
      createPrescriptionItemDto,
      req.user.userId,
    );
  }
}