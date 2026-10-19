import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePurchaseDto {
  @ApiProperty({ description: 'Supplier Id', example: 1 })
  @IsInt()
  @Min(1)
  supplier_id: number;

  @ApiProperty({ description: 'Invoice Number', example: 'INV-2026-001', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoice_number?: string;
}