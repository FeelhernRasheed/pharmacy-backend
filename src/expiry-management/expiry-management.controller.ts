import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { ExpiryManagementService } from './expiry-management.service';

@ApiTags('Expiry Management')
@ApiBearerAuth('bearer')
@Controller('expiry-management')
@UseGuards(JwtAuthGuard)
export class ExpiryManagementController {
  constructor(
    private readonly expiryManagementService: ExpiryManagementService,
  ) {}

  @Get('expired')
  getExpiredMedicines() {
    return this.expiryManagementService.getExpiredMedicines();
  }

  @Get('expiring-soon')
  getExpiringSoon(
    @Query('days') days?: string,
  ) {
    let numberOfDays = 30;

    if (days !== undefined) {
      numberOfDays = Number(days);

      if (
        !Number.isInteger(numberOfDays) ||
        numberOfDays < 0
      ) {
        throw new BadRequestException(
          'days must be a non-negative integer',
        );
      }
    }

    return this.expiryManagementService.getExpiringSoon(
      numberOfDays,
    );
  }

  @Get('valid')
  getValidMedicines() {
    return this.expiryManagementService.getValidMedicines();
  }
}