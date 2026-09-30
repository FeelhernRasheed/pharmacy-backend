import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { DatabaseService } from './database/database.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('hello')
  getHelloMessage(): string {
    return 'Hello from NestJS';
  }

  @Get('db-test')
  async testDatabase(): Promise<{ connected: boolean }> {
    const connected = await this.databaseService.testConnection();

    return {
      connected,
    };
  }
}