import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
} from 'class-validator';

export class CreatePrescriptionItemDto {
  @ApiProperty({ description: 'Prescription Id', example: 1 })
  @IsInt()
  @Min(1)
  prescription_id: number;

  @ApiProperty({ description: 'Medicine Id', example: 1 })
  @IsInt()
  @Min(1)
  medicine_id: number;

  @ApiProperty({ description: 'Dosage', example: '1 tablet' })
  @IsString()
  @IsNotEmpty()
  dosage: string;

  @ApiProperty({ description: 'Frequency', example: '3 times daily' })
  @IsString()
  @IsNotEmpty()
  frequency: string;

  @ApiProperty({ description: 'Duration', example: '7 days' })
  @IsString()
  @IsNotEmpty()
  duration: string;

  @ApiProperty({ description: 'Quantity', example: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ description: 'Instructions', example: 'Take after meals' })
  @IsString()
  @IsNotEmpty()
  instructions: string;
}