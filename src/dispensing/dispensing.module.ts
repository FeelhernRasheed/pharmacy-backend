import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';

import { DispensingController } from './dispensing.controller';
import { DispensingService } from './dispensing.service';

@Module({
  imports: [
    AuditLogsModule,
  ],
  controllers: [
    DispensingController,
  ],
  providers: [
    DispensingService,
  ],
})
export class DispensingModule {}