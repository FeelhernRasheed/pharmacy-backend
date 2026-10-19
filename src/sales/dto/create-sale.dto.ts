import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateSaleDto {
  @ApiProperty({ description: 'Patient Id', example: 1, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  patient_id?: number;
}