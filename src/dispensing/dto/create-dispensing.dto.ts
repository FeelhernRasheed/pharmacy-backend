
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateDispensingDto {
  @ApiProperty({ example: 3, description: 'ID of the prescription' })
  @IsInt()
  @Min(1)
  prescription_id: number;

  @ApiPropertyOptional({
    example: 'Prescription dispensing',
    description: 'Additional notes',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    example: 'PENDING',
    enum: ['PENDING'],
    description: 'New dispensing records must start as PENDING',
  })
  @IsOptional()
  @IsIn(['PENDING'])
  status?: string;
}
