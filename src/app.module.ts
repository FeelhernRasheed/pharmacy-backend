import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { MedicinesModule } from './medicines/medicines.module';
import { CategoriesModule } from './categories/categories.module';
import { InventoryModule } from './inventory/inventory.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { PurchasesModule } from './purchases/purchases.module';
import { PatientsModule } from './patients/patients.module';
import { SalesModule } from './sales/sales.module';
import { PaymentsModule } from './payments/payments.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { PrescriptionsModule } from './prescriptions/prescriptions.module';
import { DispensingModule } from './dispensing/dispensing.module';
import { StockAdjustmentsModule } from './stock-adjustments/stock-adjustments.module';
import { ExpiryManagementModule } from './expiry-management/expiry-management.module';
import { LowStockModule } from './low-stock/low-stock.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { ReportsModule } from './reports/reports.module';
import { HealthModule } from './health/health.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            limit: config.get<number>('RATE_LIMIT_MAX', 100),
            // Throttler v6 expects ttl in milliseconds;
            // the env value is validated in seconds.
            ttl: config.get<number>('RATE_LIMIT_TTL', 60) * 1000,
          },
        ],
      }),
    }),
    DatabaseModule,
    MedicinesModule,
    CategoriesModule,
    InventoryModule,
    SuppliersModule,
    PurchasesModule,
    PatientsModule,
    SalesModule,
    PaymentsModule,
    UsersModule,
    AuthModule,
    PrescriptionsModule,
    DispensingModule,
    StockAdjustmentsModule,
    ExpiryManagementModule,
    LowStockModule,
    AuditLogsModule,
    ReportsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}