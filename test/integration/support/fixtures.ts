import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import helmet from 'helmet';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../../../src/app.module';
import { AllExceptionsFilter } from '../../../src/common/filters/all-exceptions.filter';
import { requestIdMiddleware } from '../../../src/common/middleware/request-id.middleware';

// Mirrors the production bootstrap from src/main.ts (helmet options,
// ValidationPipe, exception filter) so integration tests exercise the
// same request pipeline as the deployed app.
export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  app.use(requestIdMiddleware);
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'data:'],
        },
      },
      frameguard: { action: 'deny' },
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.init();
  return app;
}

// Direct database access for state assertions and fixture cleanup.
// Uses the same environment-driven configuration as the application,
// which the test runner points at the isolated Docker test database.
export function createTestPool(): Pool {
  return new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 5,
  });
}

// Unique per run so a previous failed cleanup can never collide with
// a new run (repeatable without accumulating duplicates).
export const RUN_SUFFIX = `it${Date.now().toString(36)}`;

export interface Tokens {
  admin: string;
  pharmacist: string;
  cashier: string;
}

export interface FixtureIds {
  categoryIds: number[];
  medicineIds: number[];
  supplierIds: number[];
  patientIds: number[];
  purchaseIds: number[];
  purchaseItemIds: number[];
  batchIds: number[];
  saleIds: number[];
  saleItemIds: number[];
  paymentIds: number[];
  adjustmentIds: number[];
  userIds: number[];
}

export function emptyFixtureIds(): FixtureIds {
  return {
    categoryIds: [],
    medicineIds: [],
    supplierIds: [],
    patientIds: [],
    purchaseIds: [],
    purchaseItemIds: [],
    batchIds: [],
    saleIds: [],
    saleItemIds: [],
    paymentIds: [],
    adjustmentIds: [],
    userIds: [],
  };
}

const TEST_PASSWORD = 'Integration1!';

// Seeds one user per role directly in the test database (minimum
// required fixtures), then logs them in through the real /auth/login
// endpoint so JWT issuance and password verification are exercised.
export async function seedUsersAndLogin(
  app: INestApplication<App>,
  pool: Pool,
  ids: FixtureIds,
): Promise<Tokens> {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  const roles = ['ADMIN', 'PHARMACIST', 'CASHIER'] as const;
  const userIds: Record<string, number> = {};

  for (const role of roles) {
    const username = `it_${role.toLowerCase()}_${RUN_SUFFIX}`;
    const result = await pool.query(
      `INSERT INTO users (full_name, username, password_hash, role, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')
       RETURNING id`,
      [`Integration ${role}`, username, passwordHash, role],
    );
    const userId = result.rows[0].id as number;
    userIds[role] = userId;
    ids.userIds.push(userId);
  }

  const tokens = {} as Tokens;
  for (const role of roles) {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: `it_${role.toLowerCase()}_${RUN_SUFFIX}`,
        password: TEST_PASSWORD,
      })
      .expect(201);

    tokens[role.toLowerCase() as 'admin' | 'pharmacist' | 'cashier'] =
      response.body.access_token;
  }

  return tokens;
}

export function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export function futureDate(daysAhead = 400): string {
  return new Date(Date.now() + daysAhead * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export function pastDate(daysAgo = 400): string {
  return new Date(Date.now() - daysAgo * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

// Deletes every row this test run created, in FK-safe order, scoped
// strictly to the tracked parents (users, sales, purchases, medicines,
// categories, patients, suppliers this run created). Child rows are
// derived from those parents so a missed id can never orphan a row.
// Existing test data (test_admin, Test Pharmacy Supplier, or rows
// from previous runs) is untouched.
export async function cleanupFixtureIds(
  pool: Pool,
  ids: FixtureIds,
): Promise<void> {
  const del = async (sql: string, values: number[]) => {
    if (values.length > 0) {
      await pool.query(sql, [values]);
    }
  };

  await del(
    'DELETE FROM audit_logs WHERE user_id = ANY($1)',
    ids.userIds,
  );
  await del(
    `DELETE FROM stock_adjustments
     WHERE batch_id IN (
       SELECT id FROM medicine_batches WHERE medicine_id = ANY($1)
     )`,
    ids.medicineIds,
  );
  await del(
    'DELETE FROM payments WHERE sale_id = ANY($1)',
    ids.saleIds,
  );
  await del(
    'DELETE FROM sale_items WHERE sale_id = ANY($1)',
    ids.saleIds,
  );
  await del('DELETE FROM sales WHERE id = ANY($1)', ids.saleIds);
  await del(
    `DELETE FROM dispensing_items
     WHERE batch_id IN (
       SELECT id FROM medicine_batches WHERE medicine_id = ANY($1)
     )`,
    ids.medicineIds,
  );
  await del(
    'DELETE FROM purchase_items WHERE purchase_id = ANY($1)',
    ids.purchaseIds,
  );
  await del(
    'DELETE FROM purchase_items WHERE medicine_id = ANY($1)',
    ids.medicineIds,
  );
  await del(
    'DELETE FROM medicine_batches WHERE medicine_id = ANY($1)',
    ids.medicineIds,
  );
  await del(
    'DELETE FROM purchases WHERE id = ANY($1)',
    ids.purchaseIds,
  );
  await del('DELETE FROM medicines WHERE id = ANY($1)', ids.medicineIds);
  await del(
    'DELETE FROM medicine_categories WHERE id = ANY($1)',
    ids.categoryIds,
  );
  await del('DELETE FROM patients WHERE id = ANY($1)', ids.patientIds);
  await del(
    'DELETE FROM suppliers WHERE id = ANY($1)',
    ids.supplierIds,
  );
  await del('DELETE FROM users WHERE id = ANY($1)', ids.userIds);
}

// Reads a batch row directly from the database for state assertions.
export async function getBatchState(
  pool: Pool,
  batchId: number,
): Promise<{ quantity: number; expiry_date: string }> {
  const result = await pool.query(
    `SELECT quantity, expiry_date::text AS expiry_date
     FROM medicine_batches
     WHERE id = $1`,
    [batchId],
  );
  if (result.rows.length === 0) {
    throw new Error(`Batch ${batchId} not found`);
  }
  return {
    quantity: Number(result.rows[0].quantity),
    expiry_date: result.rows[0].expiry_date,
  };
}
