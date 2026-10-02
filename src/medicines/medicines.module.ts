import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';

import { MedicinesController } from './medicines.controller';
import { MedicinesService } from './medicines.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [MedicinesController],
  providers: [MedicinesService],
})
export class MedicinesModule {}