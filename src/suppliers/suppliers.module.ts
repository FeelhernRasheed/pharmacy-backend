import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';

import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [SuppliersController],
  providers: [SuppliersService],
})
export class SuppliersModule {}