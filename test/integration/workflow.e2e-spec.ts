import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request, { Test } from 'supertest';
import { App } from 'supertest/types';

import {
  FixtureIds,
  Tokens,
  auth,
  cleanupFixtureIds,
  createTestApp,
  createTestPool,
  emptyFixtureIds,
  futureDate,
  getBatchState,
  pastDate,
  RUN_SUFFIX,
  seedUsersAndLogin,
} from './support/fixtures';

// End-to-end business workflow verification against the isolated
// Docker test database (pharmacy_test). Every row created by this
// suite is tracked and removed in FK-safe order afterwards.
describe('Purchase → Inventory → Sales → Payments → Reports integration', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let tokens: Tokens;
  const ids: FixtureIds = emptyFixtureIds();

  let categoryId: number;
  let medicineId: number;
  let supplierId: number;
  let patientId: number;

  const suffix = RUN_SUFFIX;
  const batchA = `PBA-${suffix}`;
  const batchB = `PBB-${suffix}`;
  const batchD = `PBD-${suffix}`;
  const batchOversell = `PBO-${suffix}`;
  const expiredBatchNumber = `PBE-${suffix}`;

  let purchaseA: number;
  let purchaseB: number;
  let batchAId: number;
  let batchBId: number;
  let batchDId: number;
  let expiredBatchId: number;
  let saleCancelledId: number;
  let salePrecisionId: number;
  let saleFullPayId: number;

  beforeAll(async () => {
    app = await createTestApp();
    pool = createTestPool();
    tokens = await seedUsersAndLogin(app, pool, ids);

    const category = await request(app.getHttpServer())
      .post('/categories')
      .set(auth(tokens.admin))
      .send({ name: `ItCat ${suffix}`, description: 'integration' })
      .expect(201);
    categoryId = category.body.id;
    ids.categoryIds.push(categoryId);

    const medicine = await request(app.getHttpServer())
      .post('/medicines')
      .set(auth(tokens.admin))
      .send({ name: `ItMed ${suffix}`, strength: '10mg', category_id: categoryId })
      .expect(201);
    medicineId = medicine.body.id;
    ids.medicineIds.push(medicineId);

    const supplier = await request(app.getHttpServer())
      .post('/suppliers')
      .set(auth(tokens.pharmacist))
      .send({ name: `ItSup ${suffix}` })
      .expect(201);
    supplierId = supplier.body.id;
    ids.supplierIds.push(supplierId);

    const patient = await request(app.getHttpServer())
      .post('/patients')
      .set(auth(tokens.cashier))
      .send({ full_name: `It Patient ${suffix}`, phone: '0700000000' })
      .expect(201);
    patientId = patient.body.id;
    ids.patientIds.push(patientId);
  });

  afterAll(async () => {
    try {
      await cleanupFixtureIds(pool, ids);
    } finally {
      await pool.end();
      await app.close();
    }
  });

  async function createPurchase(): Promise<number> {
    const response = await request(app.getHttpServer())
      .post('/purchases')
      .set(auth(tokens.pharmacist))
      .send({ supplier_id: supplierId, invoice_number: `INV-${suffix}-${Math.random().toString(36).slice(2, 8)}` })
      .expect(201);
    ids.purchaseIds.push(response.body.id);
    return response.body.id;
  }

  function addPurchaseItem(
    purchaseId: number,
    item: {
      batch_number: string;
      expiry_date: string;
      quantity: number;
      buying_price: number;
      selling_price: number;
    },
  ): Test {
    return request(app.getHttpServer())
      .post('/purchase-items')
      .set(auth(tokens.pharmacist))
      .send({ purchase_id: purchaseId, medicine_id: medicineId, ...item });
  }

  async function createSale(): Promise<number> {
    const response = await request(app.getHttpServer())
      .post('/sales')
      .set(auth(tokens.cashier))
      .send({ patient_id: patientId })
      .expect(201);
    ids.saleIds.push(response.body.id);
    return response.body.id;
  }

  function addSaleItem(
    saleId: number,
    item: { batch_id: number; quantity: number; unit_price: number },
  ): Test {
    return request(app.getHttpServer())
      .post('/sale-items')
      .set(auth(tokens.cashier))
      .send({ sale_id: saleId, ...item });
  }

  function createPayment(
    saleId: number,
    amount: number,
    payment_method = 'CASH',
  ): Test {
    return request(app.getHttpServer())
      .post('/payments')
      .set(auth(tokens.cashier))
      .send({ sale_id: saleId, amount, payment_method });
  }

  // The stored sale total, which follows the authoritative batch price.
  async function saleTotal(saleId: number): Promise<number> {
    const result = await pool.query(
      'SELECT total_amount::text AS total_amount FROM sales WHERE id = $1',
      [saleId],
    );

    return Number(result.rows[0].total_amount);
  }

  describe('1. Purchase workflow', () => {
    it('creates a purchase for an existing supplier with default COMPLETED status and zero total', async () => {
      const response = await addPurchaseItemPurchaseFixture().expect(201);
      expect(response.body.supplier_id).toBe(supplierId);
      expect(response.body.status).toBe('COMPLETED');
      expect(Number(response.body.total_amount)).toBe(0);
      purchaseA = response.body.id;
      ids.purchaseIds.push(purchaseA);
    });

    it('rejects a purchase for an unknown supplier with 404', async () => {
      await request(app.getHttpServer())
        .post('/purchases')
        .set(auth(tokens.pharmacist))
        .send({ supplier_id: 999999 })
        .expect(404);
    });

    it('receives stock into the correct batch and recalculates the purchase total when an item is added', async () => {
      const response = await addPurchaseItem(purchaseA, {
        batch_number: batchA,
        expiry_date: futureDate(),
        quantity: 10,
        buying_price: 2.5,
        selling_price: 6,
      }).expect(201);
      ids.purchaseItemIds.push(response.body.id);
      expect(Number(response.body.subtotal)).toBe(25);

      const batchResult = await pool.query(
        `SELECT id, quantity, buying_price::text, selling_price::text, expiry_date::text
         FROM medicine_batches
         WHERE medicine_id = $1 AND batch_number = $2`,
        [medicineId, batchA],
      );
      expect(batchResult.rows).toHaveLength(1);
      batchAId = batchResult.rows[0].id;
      ids.batchIds.push(batchAId);
      expect(Number(batchResult.rows[0].quantity)).toBe(10);
      expect(batchResult.rows[0].buying_price).toBe('2.50');
      expect(batchResult.rows[0].selling_price).toBe('6.00');

      const purchase = await request(app.getHttpServer())
        .get(`/purchases/${purchaseA}`)
        .set(auth(tokens.pharmacist))
        .expect(200);
      expect(Number(purchase.body.total_amount)).toBe(25);
    });

    it('restocks the same batch number through the upsert without creating a duplicate batch row', async () => {
      await addPurchaseItem(purchaseA, {
        batch_number: batchA,
        expiry_date: futureDate(),
        quantity: 5,
        buying_price: 2.5,
        selling_price: 6,
      }).expect(201);

      const batch = await getBatchState(pool, batchAId);
      expect(batch.quantity).toBe(15);

      const purchase = await request(app.getHttpServer())
        .get(`/purchases/${purchaseA}`)
        .set(auth(tokens.pharmacist))
        .expect(200);
      expect(Number(purchase.body.total_amount)).toBe(37.5);
    });

    it('rejects an item with a past expiry date and rolls back every related change', async () => {
      const itemsBefore = await pool.query(
        'SELECT COUNT(*) FROM purchase_items WHERE purchase_id = $1',
        [purchaseA],
      );
      const batchBefore = await getBatchState(pool, batchAId);
      const totalBefore = await pool.query(
        'SELECT total_amount::text FROM purchases WHERE id = $1',
        [purchaseA],
      );

      await addPurchaseItem(purchaseA, {
        batch_number: `PBF-${suffix}`,
        expiry_date: pastDate(),
        quantity: 3,
        buying_price: 1,
        selling_price: 2,
      }).expect(400);

      const itemsAfter = await pool.query(
        'SELECT COUNT(*) FROM purchase_items WHERE purchase_id = $1',
        [purchaseA],
      );
      const batchAfter = await getBatchState(pool, batchAId);
      const totalAfter = await pool.query(
        'SELECT total_amount::text FROM purchases WHERE id = $1',
        [purchaseA],
      );

      expect(itemsAfter.rows[0].count).toBe(itemsBefore.rows[0].count);
      expect(batchAfter.quantity).toBe(batchBefore.quantity);
      expect(totalAfter.rows[0].total_amount).toBe(
        totalBefore.rows[0].total_amount,
      );

      const ghostBatch = await pool.query(
        'SELECT COUNT(*) FROM medicine_batches WHERE medicine_id = $1 AND batch_number = $2',
        [medicineId, `PBF-${suffix}`],
      );
      expect(Number(ghostBatch.rows[0].count)).toBe(0);
    });

    it('cancels an empty purchase but refuses to cancel a purchase that already received stock', async () => {
      const emptyPurchase = await createPurchase();
      await request(app.getHttpServer())
        .put(`/purchases/${emptyPurchase}`)
        .set(auth(tokens.pharmacist))
        .send({ status: 'CANCELLED' })
        .expect(200);

      const batchBefore = await getBatchState(pool, batchAId);
      await request(app.getHttpServer())
        .put(`/purchases/${purchaseA}`)
        .set(auth(tokens.pharmacist))
        .send({ status: 'CANCELLED' })
        .expect(409);

      const purchase = await request(app.getHttpServer())
        .get(`/purchases/${purchaseA}`)
        .set(auth(tokens.pharmacist))
        .expect(200);
      expect(purchase.body.status).toBe('COMPLETED');

      const batchAfter = await getBatchState(pool, batchAId);
      expect(batchAfter.quantity).toBe(batchBefore.quantity);
    });

    it('rejects adding items to a cancelled purchase', async () => {
      const cancelled = await createPurchase();
      await request(app.getHttpServer())
        .put(`/purchases/${cancelled}`)
        .set(auth(tokens.pharmacist))
        .send({ status: 'CANCELLED' })
        .expect(200);

      await addPurchaseItem(cancelled, {
        batch_number: `PBG-${suffix}`,
        expiry_date: futureDate(),
        quantity: 1,
        buying_price: 1,
        selling_price: 2,
      }).expect(400);
    });

    it('rejects deleting a purchase that has items', async () => {
      await request(app.getHttpServer())
        .delete(`/purchases/${purchaseA}`)
        .set(auth(tokens.admin))
        .expect(409);
    });

    it('concurrent duplicate item requests end with stock exactly equal to the sum of recorded items', async () => {
      purchaseB = await createPurchase();

      const item = {
        batch_number: batchB,
        expiry_date: futureDate(),
        quantity: 4,
        buying_price: 1,
        selling_price: 3,
      };

      const [first, second] = await Promise.all([
        addPurchaseItem(purchaseB, item),
        addPurchaseItem(purchaseB, item),
      ]);

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      ids.purchaseItemIds.push(first.body.id, second.body.id);

      batchBId = await batchIdFor(batchB);
      const itemSum = await pool.query(
        'SELECT COALESCE(SUM(quantity), 0) AS total FROM purchase_items WHERE purchase_id = $1',
        [purchaseB],
      );
      const batch = await getBatchState(pool, batchBId);
      expect(batch.quantity).toBe(Number(itemSum.rows[0].total));
      expect(batch.quantity).toBe(8);
    });
  });

  describe('2. Inventory workflow', () => {
    it('batch quantities agree with the recorded purchase items', async () => {
      const check = await pool.query(
        `SELECT
           (SELECT COALESCE(SUM(pi.quantity), 0)
              FROM purchase_items pi
              JOIN purchases p ON p.id = pi.purchase_id
              WHERE p.supplier_id = $1 AND p.status <> 'CANCELLED') AS purchased,
           (SELECT COALESCE(SUM(mb.quantity), 0)
              FROM medicine_batches mb
              WHERE mb.medicine_id = $2) AS in_stock`,
        [supplierId, medicineId],
      );
      expect(Number(check.rows[0].in_stock)).toBe(
        Number(check.rows[0].purchased),
      );
    });

    it('rejects creating a batch with a past expiry date', async () => {
      await request(app.getHttpServer())
        .post('/inventory')
        .set(auth(tokens.pharmacist))
        .send({
          medicine_id: medicineId,
          batch_number: `PBI-${suffix}`,
          expiry_date: pastDate(),
          quantity: 5,
          buying_price: 1,
          selling_price: 2,
        })
        .expect(400);
    });

    it('rejects updating a batch to a past expiry date but allows a future one (regression)', async () => {
      await request(app.getHttpServer())
        .put(`/inventory/${batchAId}`)
        .set(auth(tokens.pharmacist))
        .send({ expiry_date: pastDate() })
        .expect(400);

      const unchanged = await getBatchState(pool, batchAId);
      expect(unchanged.expiry_date.slice(0, 10)).toBe(futureDate());

      const newFuture = futureDate(500);
      await request(app.getHttpServer())
        .put(`/inventory/${batchAId}`)
        .set(auth(tokens.pharmacist))
        .send({ expiry_date: newFuture })
        .expect(200);

      const updated = await getBatchState(pool, batchAId);
      expect(updated.expiry_date.slice(0, 10)).toBe(newFuture);
    });

    it('rejects a stock adjustment larger than the available quantity', async () => {
      await request(app.getHttpServer())
        .post('/stock-adjustments')
        .set(auth(tokens.pharmacist))
        .send({
          batch_id: batchAId,
          adjustment_type: 'DAMAGE',
          quantity: 9999,
          reason: 'integration over-adjust',
        })
        .expect(400);
    });

    it('reduces batch quantity transactionally through a stock adjustment', async () => {
      const before = await getBatchState(pool, batchAId);
      const response = await request(app.getHttpServer())
        .post('/stock-adjustments')
        .set(auth(tokens.pharmacist))
        .send({
          batch_id: batchAId,
          adjustment_type: 'DAMAGE',
          quantity: 3,
          reason: 'integration damage',
        })
        .expect(201);
      ids.adjustmentIds.push(response.body.id);
      expect(Number(response.body.remaining_batch_quantity)).toBe(
        before.quantity - 3,
      );

      const after = await getBatchState(pool, batchAId);
      expect(after.quantity).toBe(before.quantity - 3);
    });
  });

  describe('3. Sales workflow', () => {
    it('creates a sale and deducts batch stock when an item is added', async () => {
      const saleId = await createSale();
      saleCancelledId = saleId;

      const batchBefore = await getBatchState(pool, batchBId);

      const response = await addSaleItem(saleId, {
        batch_id: batchBId,
        quantity: 6,
        unit_price: 5,
      }).expect(201);
      ids.saleItemIds.push(response.body.id);

      // The batch price is authoritative: the price sent by the client
      // is ignored, so the subtotal follows medicine_batches.selling_price.
      expect(Number(response.body.unit_price)).toBe(
        batchBefore.selling_price,
      );
      expect(Number(response.body.subtotal)).toBe(
        6 * batchBefore.selling_price,
      );

      // batchB received 8 units in the purchase concurrency test.
      const batch = await getBatchState(pool, batchBId);
      expect(batch.quantity).toBe(2);
    });

    it('rejects insufficient stock without partial changes', async () => {
      const saleId = await createSale();
      const batchBefore = await getBatchState(pool, batchBId);

      await addSaleItem(saleId, {
        batch_id: batchBId,
        quantity: batchBefore.quantity + 1,
        unit_price: 5,
      }).expect(400);

      const batchAfter = await getBatchState(pool, batchBId);
      expect(batchAfter.quantity).toBe(batchBefore.quantity);

      const items = await pool.query(
        'SELECT COUNT(*) FROM sale_items WHERE sale_id = $1',
        [saleId],
      );
      expect(Number(items.rows[0].count)).toBe(0);

      const sale = await pool.query(
        'SELECT total_amount::text, status FROM sales WHERE id = $1',
        [saleId],
      );
      expect(Number(sale.rows[0].total_amount)).toBe(0);
      expect(sale.rows[0].status).toBe('COMPLETED');
    });

    it('rejects selling an expired batch', async () => {
      const expired = await pool.query(
        `INSERT INTO medicine_batches
           (medicine_id, batch_number, expiry_date, quantity, buying_price, selling_price)
         VALUES ($1, $2, $3, 5, 1, 2)
         RETURNING id`,
        [medicineId, expiredBatchNumber, pastDate()],
      );
      expiredBatchId = expired.rows[0].id;
      ids.batchIds.push(expiredBatchId);

      const saleId = await createSale();
      const response = await addSaleItem(saleId, {
        batch_id: expiredBatchId,
        quantity: 1,
        unit_price: 2,
      }).expect(400);
      expect(JSON.stringify(response.body)).toContain('expired');

      const batch = await getBatchState(pool, expiredBatchId);
      expect(batch.quantity).toBe(5);
    });

    it('prevents concurrent overselling of the same batch', async () => {
      const oversellPurchase = await createPurchase();
      const received = await addPurchaseItem(oversellPurchase, {
        batch_number: batchOversell,
        expiry_date: futureDate(),
        quantity: 5,
        buying_price: 1,
        selling_price: 2,
      }).expect(201);
      ids.purchaseItemIds.push(received.body.id);
      const oversellBatchId = await batchIdFor(batchOversell);
      ids.batchIds.push(oversellBatchId);

      const [saleOne, saleTwo] = await Promise.all([
        createSale(),
        createSale(),
      ]);

      const [attemptOne, attemptTwo] = await Promise.all([
        addSaleItem(saleOne, { batch_id: oversellBatchId, quantity: 5, unit_price: 2 }),
        addSaleItem(saleTwo, { batch_id: oversellBatchId, quantity: 5, unit_price: 2 }),
      ]);

      const statuses = [attemptOne.status, attemptTwo.status].sort((a, b) => a - b);
      expect(statuses).toEqual([201, 400]);

      const batch = await getBatchState(pool, oversellBatchId);
      expect(batch.quantity).toBe(0);

      const soldItems = await pool.query(
        `SELECT COUNT(*) FROM sale_items
         WHERE batch_id = $1 AND sale_id = ANY($2)`,
        [oversellBatchId, [saleOne, saleTwo]],
      );
      expect(Number(soldItems.rows[0].count)).toBe(1);
    });

    it('cancelling a sale restores stock and cancelled sales are frozen', async () => {
      const batchBefore = await getBatchState(pool, batchBId);
      const saleItems = await pool.query(
        'SELECT COALESCE(SUM(quantity), 0) AS qty FROM sale_items WHERE sale_id = $1',
        [saleCancelledId],
      );
      const soldQuantity = Number(saleItems.rows[0].qty);
      expect(soldQuantity).toBeGreaterThan(0);

      await request(app.getHttpServer())
        .put(`/sales/${saleCancelledId}`)
        .set(auth(tokens.admin))
        .send({ status: 'CANCELLED' })
        .expect(200);

      const batchAfter = await getBatchState(pool, batchBId);
      expect(batchAfter.quantity).toBe(batchBefore.quantity + soldQuantity);

      await request(app.getHttpServer())
        .put(`/sales/${saleCancelledId}`)
        .set(auth(tokens.admin))
        .send({ status: 'COMPLETED' })
        .expect(409);

      await addSaleItem(saleCancelledId, {
        batch_id: batchBId,
        quantity: 1,
        unit_price: 5,
      }).expect(400);

      await createPayment(saleCancelledId, 1).expect(400);

      await request(app.getHttpServer())
        .delete(`/sales/${saleCancelledId}`)
        .set(auth(tokens.admin))
        .expect(409);
    });
  });

  describe('4. Payments workflow', () => {
    // A dedicated batch with enough stock for the idempotency tests, so
    // they do not depend on the stock left over by the other tests.
    const batchI = `PBI-${suffix}`;
    let batchIId: number;

    beforeAll(async () => {
      const purchase = await createPurchase();
      const received = await addPurchaseItem(purchase, {
        batch_number: batchI,
        expiry_date: futureDate(),
        quantity: 20,
        buying_price: 0.05,
        selling_price: 0.1,
      }).expect(201);
      ids.purchaseItemIds.push(received.body.id);
      batchIId = await batchIdFor(batchI);
      ids.batchIds.push(batchIId);
    });

    it('accepts an exact final payment despite binary floating-point subtraction (regression)', async () => {
      const received = await addPurchaseItem(await createPurchase(), {
        batch_number: batchD,
        expiry_date: futureDate(),
        quantity: 10,
        buying_price: 0.05,
        selling_price: 0.1,
      }).expect(201);
      ids.purchaseItemIds.push(received.body.id);
      batchDId = await batchIdFor(batchD);
      ids.batchIds.push(batchDId);

      salePrecisionId = await createSale();
      const item = await addSaleItem(salePrecisionId, {
        batch_id: batchDId,
        quantity: 3,
        unit_price: 0.1,
      }).expect(201);
      ids.saleItemIds.push(item.body.id);

      const sale = await pool.query(
        'SELECT total_amount::text FROM sales WHERE id = $1',
        [salePrecisionId],
      );
      expect(Number(sale.rows[0].total_amount)).toBe(0.3);

      const firstPayment = await createPayment(salePrecisionId, 0.1).expect(201);
      ids.paymentIds.push(firstPayment.body.id);
      // 0.30 - 0.10 is 0.1999... in IEEE floats; the final 0.20
      // payment must still be accepted.
      const finalPayment = await createPayment(salePrecisionId, 0.2).expect(201);
      ids.paymentIds.push(finalPayment.body.id);

      const paid = await pool.query(
        `SELECT COALESCE(SUM(amount), 0)::text AS paid
         FROM payments WHERE sale_id = $1 AND status = 'COMPLETED'`,
        [salePrecisionId],
      );
      expect(Number(paid.rows[0].paid)).toBe(0.3);
    });

    it('rejects overpayment with the remaining balance in the message', async () => {
      saleFullPayId = await createSale();
      // batchD has 7 units left after the precision-sale item.
      const item = await addSaleItem(saleFullPayId, {
        batch_id: batchDId,
        quantity: 5,
        unit_price: 1,
      }).expect(201);
      ids.saleItemIds.push(item.body.id);

      // The sale total follows the batch price, so the payment has to
      // cover exactly that total to leave a remaining amount of 0.00.
      const total = await saleTotal(saleFullPayId);
      const first = await createPayment(saleFullPayId, total).expect(201);
      ids.paymentIds.push(first.body.id);

      const overpay = await createPayment(saleFullPayId, 0.01).expect(400);
      expect(JSON.stringify(overpay.body)).toContain('Remaining amount: 0.00');
    });

    it('rejects payments for unknown sales', async () => {
      await createPayment(999999, 5).expect(404);
    });

    it('validates payment method and amount at the DTO level', async () => {
      await createPayment(saleFullPayId, 1, 'BITCOIN').expect(400);
      await createPayment(saleFullPayId, 0).expect(400);
    });

    it('keeps every payment row consistent with its sale', async () => {
      const inconsistent = await pool.query(
        `SELECT p.id
         FROM payments p
         JOIN sales s ON s.id = p.sale_id
         WHERE p.sale_id = ANY($1)
           AND (p.amount <= 0 OR s.status = 'CANCELLED')`,
        [ids.saleIds],
      );
      expect(inconsistent.rows).toHaveLength(0);

      const overpaid = await pool.query(
        `SELECT sale_id
         FROM (
           SELECT sale_id, SUM(amount) AS paid
           FROM payments
           WHERE status = 'COMPLETED' AND sale_id = ANY($1)
           GROUP BY sale_id
         ) totals
         JOIN sales s ON s.id = totals.sale_id
         WHERE totals.paid > s.total_amount`,
        [ids.saleIds],
      );
      expect(overpaid.rows).toHaveLength(0);
    });

    it('replays a repeated payment with the same Idempotency-Key instead of charging twice', async () => {
      const saleId = await createSale();
      const item = await addSaleItem(saleId, {
        batch_id: batchIId,
        quantity: 1,
        unit_price: 0.1,
      }).expect(201);
      ids.saleItemIds.push(item.body.id);

      const total = await saleTotal(saleId);
      const key = `it-${suffix}-payment`;

      const first = await request(app.getHttpServer())
        .post('/payments')
        .set(auth(tokens.cashier))
        .set('Idempotency-Key', key)
        .send({ sale_id: saleId, amount: total, payment_method: 'CASH' })
        .expect(201);
      ids.paymentIds.push(first.body.id);

      const replay = await request(app.getHttpServer())
        .post('/payments')
        .set(auth(tokens.cashier))
        .set('Idempotency-Key', key)
        .send({ sale_id: saleId, amount: total, payment_method: 'CASH' })
        .expect(201);

      // The repeated request is answered from the stored response and
      // must not create a second payment row.
      expect(replay.headers['idempotency-replayed']).toBe('true');
      expect(replay.body.id).toBe(first.body.id);

      const payments = await pool.query(
        'SELECT COUNT(*) FROM payments WHERE sale_id = $1',
        [saleId],
      );
      expect(Number(payments.rows[0].count)).toBe(1);
    });

    it('rejects a reused Idempotency-Key with a different payload', async () => {
      const saleId = await createSale();
      const item = await addSaleItem(saleId, {
        batch_id: batchIId,
        quantity: 1,
        unit_price: 0.1,
      }).expect(201);
      ids.saleItemIds.push(item.body.id);

      const total = await saleTotal(saleId);
      const key = `it-${suffix}-payment-conflict`;

      const first = await request(app.getHttpServer())
        .post('/payments')
        .set(auth(tokens.cashier))
        .set('Idempotency-Key', key)
        .send({ sale_id: saleId, amount: total, payment_method: 'CASH' })
        .expect(201);
      ids.paymentIds.push(first.body.id);

      // The same key with a different amount is a different request:
      // it must be rejected instead of replaying the stored response.
      const conflict = await request(app.getHttpServer())
        .post('/payments')
        .set(auth(tokens.cashier))
        .set('Idempotency-Key', key)
        .send({ sale_id: saleId, amount: total + 1, payment_method: 'CASH' })
        .expect(409);
      expect(JSON.stringify(conflict.body)).toContain('Idempotency-Key');

      const payments = await pool.query(
        'SELECT COUNT(*) FROM payments WHERE sale_id = $1',
        [saleId],
      );
      expect(Number(payments.rows[0].count)).toBe(1);
    });

    it('replays a repeated request whose payload is written differently', async () => {
      const saleId = await createSale();
      const item = await addSaleItem(saleId, {
        batch_id: batchIId,
        quantity: 1,
        unit_price: 0.1,
      }).expect(201);
      ids.saleItemIds.push(item.body.id);

      const total = await saleTotal(saleId);
      const key = `it-${suffix}-payment-canonical`;

      const first = await request(app.getHttpServer())
        .post('/payments')
        .set(auth(tokens.cashier))
        .set('Idempotency-Key', key)
        .send({ sale_id: saleId, amount: total, payment_method: 'CASH' })
        .expect(201);
      ids.paymentIds.push(first.body.id);

      // Same values, different key order and an integer amount written
      // as a float: the canonical payload is identical, so the request
      // is a replay and not a conflict.
      const replay = await request(app.getHttpServer())
        .post('/payments')
        .set(auth(tokens.cashier))
        .set('Idempotency-Key', key)
        .send({ payment_method: 'CASH', amount: total, sale_id: saleId })
        .expect(201);

      expect(replay.headers['idempotency-replayed']).toBe('true');
      expect(replay.body.id).toBe(first.body.id);

      const payments = await pool.query(
        'SELECT COUNT(*) FROM payments WHERE sale_id = $1',
        [saleId],
      );
      expect(Number(payments.rows[0].count)).toBe(1);
    });

    it('executes a repeated request only once when it is sent concurrently', async () => {
      const saleId = await createSale();
      const item = await addSaleItem(saleId, {
        batch_id: batchIId,
        quantity: 1,
        unit_price: 0.1,
      }).expect(201);
      ids.saleItemIds.push(item.body.id);

      const total = await saleTotal(saleId);
      const key = `it-${suffix}-payment-concurrent`;

      const responses = await Promise.all([
        request(app.getHttpServer())
          .post('/payments')
          .set(auth(tokens.cashier))
          .set('Idempotency-Key', key)
          .send({ sale_id: saleId, amount: total, payment_method: 'CASH' }),
        request(app.getHttpServer())
          .post('/payments')
          .set(auth(tokens.cashier))
          .set('Idempotency-Key', key)
          .send({ sale_id: saleId, amount: total, payment_method: 'CASH' }),
      ]);

      for (const response of responses) {
        expect(response.status).toBe(201);
        ids.paymentIds.push(response.body.id);
      }

      // One request executed the payment, the other one replayed it.
      const replayed = responses.filter(
        (response) => response.headers['idempotency-replayed'] === 'true',
      );
      expect(replayed).toHaveLength(1);
      expect(responses[0].body.id).toBe(responses[1].body.id);

      const payments = await pool.query(
        'SELECT COUNT(*) FROM payments WHERE sale_id = $1',
        [saleId],
      );
      expect(Number(payments.rows[0].count)).toBe(1);
    });

    it('releases the key after a failed payment so the same key can be retried', async () => {
      const saleId = await createSale();
      const item = await addSaleItem(saleId, {
        batch_id: batchIId,
        quantity: 1,
        unit_price: 0.1,
      }).expect(201);
      ids.saleItemIds.push(item.body.id);

      const total = await saleTotal(saleId);
      const key = `it-${suffix}-payment-retry`;

      // The payment fails (the amount is not covered) and the whole
      // transaction is rolled back, so the key is released again.
      await request(app.getHttpServer())
        .post('/payments')
        .set(auth(tokens.cashier))
        .set('Idempotency-Key', key)
        .send({ sale_id: saleId, amount: total + 5, payment_method: 'CASH' })
        .expect(400);

      const retry = await request(app.getHttpServer())
        .post('/payments')
        .set(auth(tokens.cashier))
        .set('Idempotency-Key', key)
        .send({ sale_id: saleId, amount: total, payment_method: 'CASH' })
        .expect(201);
      ids.paymentIds.push(retry.body.id);

      expect(retry.headers['idempotency-replayed']).toBeUndefined();

      const payments = await pool.query(
        'SELECT COUNT(*) FROM payments WHERE sale_id = $1',
        [saleId],
      );
      expect(Number(payments.rows[0].count)).toBe(1);
    });

    it('does not use X-Request-Id as an idempotency key', async () => {
      const firstSaleId = await createSale();
      const firstItem = await addSaleItem(firstSaleId, {
        batch_id: batchIId,
        quantity: 1,
        unit_price: 0.1,
      }).expect(201);
      ids.saleItemIds.push(firstItem.body.id);

      const secondSaleId = await createSale();
      const secondItem = await addSaleItem(secondSaleId, {
        batch_id: batchIId,
        quantity: 1,
        unit_price: 0.1,
      }).expect(201);
      ids.saleItemIds.push(secondItem.body.id);

      const requestId = `it-${suffix}-request-id`;

      const first = await request(app.getHttpServer())
        .post('/payments')
        .set(auth(tokens.cashier))
        .set('X-Request-Id', requestId)
        .send({
          sale_id: firstSaleId,
          amount: await saleTotal(firstSaleId),
          payment_method: 'CASH',
        })
        .expect(201);
      ids.paymentIds.push(first.body.id);

      const second = await request(app.getHttpServer())
        .post('/payments')
        .set(auth(tokens.cashier))
        .set('X-Request-Id', requestId)
        .send({
          sale_id: secondSaleId,
          amount: await saleTotal(secondSaleId),
          payment_method: 'CASH',
        })
        .expect(201);
      ids.paymentIds.push(second.body.id);

      // Without an Idempotency-Key both requests are executed, the
      // correlation id does not turn the second one into a replay.
      expect(second.headers['idempotency-replayed']).toBeUndefined();
      expect(second.body.id).not.toBe(first.body.id);

      const keys = await pool.query(
        'SELECT COUNT(*) FROM idempotency_keys WHERE idempotency_key = $1',
        [requestId],
      );
      expect(Number(keys.rows[0].count)).toBe(0);
    });

    it('replays a legacy record that has no fingerprint', async () => {
      const saleId = await createSale();
      const item = await addSaleItem(saleId, {
        batch_id: batchIId,
        quantity: 1,
        unit_price: 0.1,
      }).expect(201);
      ids.saleItemIds.push(item.body.id);

      const total = await saleTotal(saleId);
      const key = `it-${suffix}-payment-legacy`;

      // A record written before the fingerprint column existed: the
      // payload cannot be verified, so the stored response is replayed
      // without verification.
      await pool.query(
        `INSERT INTO idempotency_keys
           (endpoint, idempotency_key, status_code, response_body, request_hash)
         VALUES ('POST /payments', $1, 201, $2::jsonb, NULL)`,
        [key, JSON.stringify({ id: 424242, sale_id: saleId })],
      );

      const replay = await request(app.getHttpServer())
        .post('/payments')
        .set(auth(tokens.cashier))
        .set('Idempotency-Key', key)
        .send({ sale_id: saleId, amount: total, payment_method: 'CASH' })
        .expect(201);

      expect(replay.headers['idempotency-replayed']).toBe('true');
      expect(replay.body.id).toBe(424242);

      const payments = await pool.query(
        'SELECT COUNT(*) FROM payments WHERE sale_id = $1',
        [saleId],
      );
      expect(Number(payments.rows[0].count)).toBe(0);
    });
  });

  describe('5. Reports workflow', () => {
    it('sales report matches the underlying sales rows', async () => {
      const report = await request(app.getHttpServer())
        .get('/reports/sales')
        .set(auth(tokens.admin))
        .expect(200);

      const sql = await pool.query(
        `SELECT
           COUNT(*)::text AS total_transactions,
           COALESCE(SUM(total_amount) FILTER (WHERE status = 'COMPLETED'), 0)::text AS total_sales,
           COUNT(*) FILTER (WHERE status = 'COMPLETED')::text AS completed_transactions,
           COUNT(*) FILTER (WHERE status = 'CANCELLED')::text AS cancelled_transactions
         FROM sales`,
      );

      expect(Number(report.body.total_transactions)).toBe(
        Number(sql.rows[0].total_transactions),
      );
      expect(Number(report.body.total_sales)).toBe(
        Number(sql.rows[0].total_sales),
      );
      expect(Number(report.body.completed_transactions)).toBe(
        Number(sql.rows[0].completed_transactions),
      );
      expect(Number(report.body.cancelled_transactions)).toBe(
        Number(sql.rows[0].cancelled_transactions),
      );
      expect(Number(report.body.cancelled_transactions)).toBeGreaterThanOrEqual(1);
    });

    it('inventory report stock values match the batch rows', async () => {
      const report = await request(app.getHttpServer())
        .get('/reports/inventory')
        .set(auth(tokens.admin))
        .expect(200);

      const ourBatch = report.body.find(
        (row: { batch_id: number }) => row.batch_id === batchAId,
      );
      expect(ourBatch).toBeDefined();

      const batch = await pool.query(
        'SELECT quantity, buying_price::text FROM medicine_batches WHERE id = $1',
        [batchAId],
      );
      expect(Number(ourBatch.stock_value)).toBe(
        Number(batch.rows[0].quantity) * Number(batch.rows[0].buying_price),
      );
    });

    it('payments report includes the totals recorded by this run', async () => {
      const report = await request(app.getHttpServer())
        .get('/reports/payments')
        .set(auth(tokens.admin))
        .expect(200);

      const cashRow = report.body.find(
        (row: { payment_method: string; status: string }) =>
          row.payment_method === 'CASH' && row.status === 'COMPLETED',
      );
      expect(cashRow).toBeDefined();

      const sql = await pool.query(
        `SELECT COALESCE(SUM(amount), 0)::text AS total
         FROM payments WHERE payment_method = 'CASH' AND status = 'COMPLETED'`,
      );
      expect(Number(cashRow.total_amount)).toBe(Number(sql.rows[0].total));
    });

    it('purchases report lists this run purchases with matching totals', async () => {
      const report = await request(app.getHttpServer())
        .get('/reports/purchases')
        .set(auth(tokens.admin))
        .expect(200);

      const row = report.body.find(
        (entry: { purchase_id: number }) => entry.purchase_id === purchaseA,
      );
      expect(row).toBeDefined();
      expect(row.status).toBe('COMPLETED');

      const sql = await pool.query(
        'SELECT total_amount::text FROM purchases WHERE id = $1',
        [purchaseA],
      );
      expect(Number(row.total_amount)).toBe(Number(sql.rows[0].total_amount));
    });

    it('reports are restricted to ADMIN', async () => {
      await request(app.getHttpServer())
        .get('/reports/sales')
        .set(auth(tokens.cashier))
        .expect(403);
      await request(app.getHttpServer())
        .get('/reports/sales')
        .set(auth(tokens.pharmacist))
        .expect(403);
    });
  });

  describe('6. Authentication and authorization', () => {
    it('rejects unauthenticated requests', async () => {
      await request(app.getHttpServer()).get('/sales').expect(401);
      await request(app.getHttpServer()).get('/reports/sales').expect(401);
    });

    it('rejects a CASHIER adding purchase items', async () => {
      await request(app.getHttpServer())
        .post('/purchase-items')
        .set(auth(tokens.cashier))
        .send({
          purchase_id: purchaseA,
          medicine_id: medicineId,
          batch_number: `PBH-${suffix}`,
          expiry_date: futureDate(),
          quantity: 1,
          buying_price: 1,
          selling_price: 2,
        })
        .expect(403);
    });

    it('rejects unknown body fields and invalid payloads', async () => {
      await request(app.getHttpServer())
        .post('/payments')
        .set(auth(tokens.cashier))
        .send({ sale_id: saleFullPayId, amount: 1, payment_method: 'CASH', role: 'ADMIN' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/payments')
        .set(auth(tokens.cashier))
        .send({ sale_id: saleFullPayId, payment_method: 'CASH' })
        .expect(400);
    });

    it('rejects wrong credentials with a generic 401', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: `it_admin_${suffix}`, password: 'wrong-password' })
        .expect(401);
      expect(JSON.stringify(response.body)).not.toContain('password_hash');
    });

    it('revokes access immediately when a user is deactivated', async () => {
      const created = await pool.query(
        `INSERT INTO users (full_name, username, password_hash, role, status)
         VALUES ('Integration Revoked', $1, $2, 'CASHIER', 'ACTIVE')
         RETURNING id`,
        [
          `it_revoked_${suffix}`,
          // bcrypt hash of the seed password is not needed for this
          // test beyond the initial login; reuse a valid hash form.
          '$2b$10$EkVcMwCKZYGsv0YY2kH3fOLM9hhhkWa6i5h/YHX7uS5Igy4ieeS2W',
        ],
      );
      const revokedId = created.rows[0].id as number;
      ids.userIds.push(revokedId);

      // Login is rejected for unknown passwords; instead give the
      // user a real hash through the admin users endpoint.
      await request(app.getHttpServer())
        .put(`/users/${revokedId}`)
        .set(auth(tokens.admin))
        .send({ password: 'Revoked1!' })
        .expect(200);

      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: `it_revoked_${suffix}`, password: 'Revoked1!' })
        .expect(201);
      const token = login.body.access_token;

      await request(app.getHttpServer())
        .get('/sales')
        .set(auth(token))
        .expect(200);

      await pool.query(
        `UPDATE users SET status = 'INACTIVE' WHERE id = $1`,
        [revokedId],
      );

      await request(app.getHttpServer())
        .get('/sales')
        .set(auth(token))
        .expect(401);
    });
  });

  async function batchIdFor(batchNumber: string): Promise<number> {
    const result = await pool.query(
      'SELECT id FROM medicine_batches WHERE medicine_id = $1 AND batch_number = $2',
      [medicineId, batchNumber],
    );
    if (result.rows.length === 0) {
      throw new Error(`Batch ${batchNumber} not found`);
    }
    return result.rows[0].id;
  }

  function addPurchaseItemPurchaseFixture(): Test {
    return request(app.getHttpServer())
      .post('/purchases')
      .set(auth(tokens.pharmacist))
      .send({
        supplier_id: supplierId,
        invoice_number: `INV-A-${suffix}`,
      });
  }
});
