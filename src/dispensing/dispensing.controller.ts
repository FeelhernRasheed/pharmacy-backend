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

import { CreateDispensingDto } from './dto/create-dispensing.dto';
import { CreateDispensingItemDto } from './dto/create-dispensing-item.dto';
import { DispensingService } from './dispensing.service';

@Controller('dispensing')
@UseGuards(JwtAuthGuard)
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
  createDispensing(
    @Body() createDispensingDto: CreateDispensingDto,
  ) {
    return this.dispensingService.createDispensing(
      createDispensingDto,
    );
  }

  @Post('items')
  createDispensingItem(
    @Body()
    createDispensingItemDto: CreateDispensingItemDto,
  ) {
    return this.dispensingService.createDispensingItem(
      createDispensingItemDto,
    );
  }
}