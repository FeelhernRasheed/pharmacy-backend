import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateMedicineDto {
  @ApiProperty({ description: 'Name', example: 'Paracetamol' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ description: 'Strength', example: '500mg' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  strength: string;

  @ApiProperty({ description: 'Category Id', example: 1 })
  @IsInt()
  category_id: number;
}