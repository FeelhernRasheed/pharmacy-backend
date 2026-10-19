import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
} from 'class-validator';

export class CreateStockAdjustmentDto {
  @ApiProperty({ description: 'Batch Id', example: 1 })
  @IsInt()
  @Min(1)
  batch_id: number;

  @IsString()
  @IsNotEmpty()
  @IsIn([
    'DAMAGE',
    'EXPIRED',
    'LOST',
    'CORRECTION',
  ])
  @ApiProperty({ description: 'Adjustment Type', example: 'Sample value' })
  adjustment_type: string;

  @ApiProperty({ description: 'Quantity', example: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ description: 'Reason', example: 'Damaged packaging' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}