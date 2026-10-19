import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateSaleItemDto {
  @ApiProperty({ description: 'Sale Id', example: 1 })
  @IsInt()
  @Min(1)
  sale_id: number;

  @ApiProperty({ description: 'Batch Id', example: 1 })
  @IsInt()
  @Min(1)
  batch_id: number;

  @ApiProperty({ description: 'Quantity', example: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ description: 'Unit Price', example: 1 })
  @IsNumber()
  @Min(0)
  unit_price: number;
}