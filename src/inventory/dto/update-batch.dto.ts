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
  @IsOptional()
  @IsString()
  @MaxLength(100)
  batch_number?: string;

  @IsOptional()
  @IsDateString()
  expiry_date?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  buying_price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  selling_price?: number;
}