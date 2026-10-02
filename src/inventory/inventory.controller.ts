import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
  ) {}

  @Get()
  getBatches() {
    return this.inventoryService.getBatches();
  }

  @Get(':id')
  getBatchById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.inventoryService.getBatchById(id);
  }

  @Post()
  createBatch(
    @Body() createBatchDto: CreateBatchDto,
    @Request() request: any,
  ) {
    return this.inventoryService.createBatch(
      createBatchDto,
      request.user.userId,
    );
  }

  @Put(':id')
  updateBatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBatchDto: UpdateBatchDto,
    @Request() request: any,
  ) {
    return this.inventoryService.updateBatch(
      id,
      updateBatchDto,
      request.user.userId,
    );
  }

  @Delete(':id')
  deleteBatch(
    @Param('id', ParseIntPipe) id: number,
    @Request() request: any,
  ) {
    return this.inventoryService.deleteBatch(
      id,
      request.user.userId,
    );
  }
}