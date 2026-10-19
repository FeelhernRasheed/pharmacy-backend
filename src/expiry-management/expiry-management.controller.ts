import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

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

  @ApiOperation({ summary: 'List expired medicine batches' })
  @Get('expired')
  getExpiredMedicines() {
    return this.expiryManagementService.getExpiredMedicines();
  }

  @ApiOperation({ summary: 'List batches expiring within N days' })
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

  @ApiOperation({ summary: 'List non-expired medicine batches' })
  @Get('valid')
  getValidMedicines() {
    return this.expiryManagementService.getValidMedicines();
  }
}