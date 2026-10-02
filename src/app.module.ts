import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
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


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}