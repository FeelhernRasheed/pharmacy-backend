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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { CreateDispensingDto } from './dto/create-dispensing.dto';
import { CreateDispensingItemDto } from './dto/create-dispensing-item.dto';
import { DispensingService } from './dispensing.service';

@ApiTags('Dispensing')
@ApiBearerAuth('bearer')
@Controller('dispensing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DispensingController {
  constructor(
    private readonly dispensingService: DispensingService,
  ) {}

  @Get()
  getDispensings() {
    return this.dispensingService.getDispensings();
  }

  @Get(':id')
  getDispensingById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.dispensingService.getDispensingById(id);
  }

  @Post()
  @Roles('ADMIN', 'PHARMACIST')
  createDispensing(
    @Body() createDispensingDto: CreateDispensingDto,
    @Req() req: any,
  ) {
    return this.dispensingService.createDispensing(
      createDispensingDto,
      req.user.userId,
    );
  }

  @Post('items')
  @Roles('ADMIN', 'PHARMACIST')
  createDispensingItem(
    @Body() createDispensingItemDto: CreateDispensingItemDto,
    @Req() req: any,
  ) {
    return this.dispensingService.createDispensingItem(
      createDispensingItemDto,
      req.user.userId,
    );
  }
}