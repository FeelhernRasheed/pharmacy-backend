import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
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
  ) {
    return this.inventoryService.createBatch(
      createBatchDto,
    );
  }

  @Put(':id')
  updateBatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBatchDto: UpdateBatchDto,
  ) {
    return this.inventoryService.updateBatch(
      id,
      updateBatchDto,
    );
  }

  @Delete(':id')
  deleteBatch(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.inventoryService.deleteBatch(id);
  }
}