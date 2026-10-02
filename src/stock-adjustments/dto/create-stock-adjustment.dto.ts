import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
} from 'class-validator';

export class CreateStockAdjustmentDto {
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
  adjustment_type: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsInt()
  @Min(1)
  adjusted_by: number;
}