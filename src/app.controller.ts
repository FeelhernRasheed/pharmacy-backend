import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import {ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';
import { DatabaseService } from './database/database.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { Roles } from './auth/decorators/roles.decorator';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly databaseService: DatabaseService,
  ) {}

  @ApiOperation({ summary: 'Health check' })
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @ApiOperation({ summary: 'Greeting message' })
  @Get('hello')
  getHelloMessage(): string {
    return 'Hello from NestJS';
  }

  @ApiOperation({ summary: 'Test database connection' })
  @Get('db-test')
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async testDatabase(): Promise<{ connected: boolean }> {
    const connected = await this.databaseService.testConnection();

    return {
      connected,
    };
  }
}