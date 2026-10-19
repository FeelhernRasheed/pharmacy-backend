import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({ description: 'Full Name', example: 'Jane Doe', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  full_name?: string;

  @ApiProperty({ description: 'Username', example: 'jdoe', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  username?: string;

  @ApiProperty({ description: 'Password', example: 'S3curePass!', required: false })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiProperty({ description: 'Role', example: 'ADMIN', required: false, enum: ['ADMIN', 'PHARMACIST', 'CASHIER'] })
  @IsOptional()
  @IsString()
  @IsIn(['ADMIN', 'PHARMACIST', 'CASHIER'])
  role?: string;

  @ApiProperty({ description: 'Status', example: 'ACTIVE', required: false, enum: ['ACTIVE', 'INACTIVE'] })
  @IsOptional()
  @IsString()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;
}