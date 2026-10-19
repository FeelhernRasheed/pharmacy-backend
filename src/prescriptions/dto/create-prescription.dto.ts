import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePrescriptionDto {
  @ApiProperty({ description: 'Patient Id', example: 1 })
  @IsInt()
  @Min(1)
  patient_id: number;

  @ApiProperty({ description: 'Notes', example: 'Optional notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Status', example: 'PENDING', required: false, enum: ['PENDING'] })
  @IsOptional()
  @IsIn(['PENDING'])
  status?: string;
}