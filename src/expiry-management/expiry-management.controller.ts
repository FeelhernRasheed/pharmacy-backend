import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { ExpiryManagementService } from './expiry-management.service';

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
    const numberOfDays = days
      ? Number(days)
      : 30;

    return this.expiryManagementService.getExpiringSoon(
      numberOfDays,
    );
  }

  @Get('valid')
  getValidMedicines() {
    return this.expiryManagementService.getValidMedicines();
  }
}