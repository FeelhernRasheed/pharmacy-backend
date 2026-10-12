import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';

import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';

@Module({
  imports: [
    AuditLogsModule,
  ],
  controllers: [
    PrescriptionsController,
  ],
  providers: [
    PrescriptionsService,
  ],
})
export class PrescriptionsModule {}