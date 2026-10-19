import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateBatchDto {
  @ApiProperty({ description: 'Batch Number', example: 'BATCH-001', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  batch_number?: string;

  @ApiProperty({ description: 'Expiry Date', example: '2026-12-31', required: false })
  @IsOptional()
  @IsDateString()
  expiry_date?: string;

  @ApiProperty({ description: 'Quantity', example: 1, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiProperty({ description: 'Buying Price', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  buying_price?: number;

  @ApiProperty({ description: 'Selling Price', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  selling_price?: number;
}