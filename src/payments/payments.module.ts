import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { IdempotencyModule } from '../common/idempotency/idempotency.module';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [
    AuditLogsModule,
    IdempotencyModule,
  ],
  controllers: [
    PaymentsController,
  ],
  providers: [
    PaymentsService,
  ],
})
export class PaymentsModule {}
