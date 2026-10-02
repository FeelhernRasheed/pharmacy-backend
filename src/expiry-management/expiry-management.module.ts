import { Module } from '@nestjs/common';

import { ExpiryManagementController } from './expiry-management.controller';
import { ExpiryManagementService } from './expiry-management.service';

@Module({
  controllers: [ExpiryManagementController],
  providers: [ExpiryManagementService],
})
export class ExpiryManagementModule {}