import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateCategoryDto {
  @ApiProperty({ description: 'Name', example: 'Paracetamol', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ description: 'Description', example: 'Sample value', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}