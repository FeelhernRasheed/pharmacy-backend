import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';

import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

@Module({
  imports: [
    AuditLogsModule,
  ],
  controllers: [
    PatientsController,
  ],
  providers: [
    PatientsService,
  ],
})
export class PatientsModule {}