
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import {ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('bearer')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  @ApiOperation({ summary: 'List users' })
  @Get()
  @Roles('ADMIN')
  getUsers() {
    return this.usersService.getUsers();
  }

  @ApiOperation({ summary: 'Get user by ID' })
  @Get(':id')
  @Roles('ADMIN')
  getUserById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.usersService.getUserById(id);
  }

  @ApiOperation({ summary: 'Create user (password is hashed)' })
  @Post()
  @Roles('ADMIN')
  createUser(
    @Body() createUserDto: CreateUserDto,
    @Request() request: any,
  ) {
    return this.usersService.createUser(
      createUserDto,
      request.user.userId,
    );
  }

  @ApiOperation({ summary: 'Update user' })
  @Put(':id')
  @Roles('ADMIN')
  updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @Request() request: any,
  ) {
    return this.usersService.updateUser(
      id,
      updateUserDto,
      request.user.userId,
    );
  }
}
