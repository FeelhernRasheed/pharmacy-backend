import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ description: 'Full Name', example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  full_name: string;

  @ApiProperty({ description: 'Username', example: 'jdoe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  username: string;

  @ApiProperty({ description: 'Password', example: 'S3curePass!' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ description: 'Role', example: 'ADMIN', enum: ['ADMIN', 'PHARMACIST', 'CASHIER'] })
  @IsString()
  @IsIn(['ADMIN', 'PHARMACIST', 'CASHIER'])
  role: string;
}