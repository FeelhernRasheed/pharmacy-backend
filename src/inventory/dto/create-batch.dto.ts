import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBatchDto {
  @ApiProperty({ description: 'Medicine Id', example: 1 })
  @IsInt()
  @Min(1)
  medicine_id: number;

  @ApiProperty({ description: 'Batch Number', example: 'BATCH-001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  batch_number: string;

  @ApiProperty({ description: 'Expiry Date', example: '2026-12-31' })
  @IsDateString()
  expiry_date: string;

  @ApiProperty({ description: 'Quantity', example: 1 })
  @IsInt()
  @Min(0)
  quantity: number;

  @ApiProperty({ description: 'Buying Price', example: 1 })
  @IsNumber()
  @Min(0)
  buying_price: number;

  @ApiProperty({ description: 'Selling Price', example: 1 })
  @IsNumber()
  @Min(0)
  selling_price: number;
}