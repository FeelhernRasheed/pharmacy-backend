import {
  Injectable,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

@Injectable()
export class ExpiryManagementService {
  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

  async getExpiredMedicines() {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           mb.id,
           mb.batch_number,
           mb.medicine_id,
           m.name AS medicine_name,
           m.strength,
           mb.expiry_date,
           mb.quantity,
           mb.buying_price,
           mb.selling_price
         FROM medicine_batches mb
         INNER JOIN medicines m
           ON mb.medicine_id = m.id
         WHERE mb.expiry_date < CURRENT_DATE
         ORDER BY mb.expiry_date ASC`,
      );

    return result.rows;
  }

  async getExpiringSoon(days: number = 30) {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           mb.id,
           mb.batch_number,
           mb.medicine_id,
           m.name AS medicine_name,
           m.strength,
           mb.expiry_date,
           mb.quantity,
           mb.buying_price,
           mb.selling_price
         FROM medicine_batches mb
         INNER JOIN medicines m
           ON mb.medicine_id = m.id
         WHERE mb.expiry_date >= CURRENT_DATE
           AND mb.expiry_date <= CURRENT_DATE + ($1 * INTERVAL '1 day')
         ORDER BY mb.expiry_date ASC`,
        [days],
      );

    return result.rows;
  }

  async getValidMedicines() {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           mb.id,
           mb.batch_number,
           mb.medicine_id,
           m.name AS medicine_name,
           m.strength,
           mb.expiry_date,
           mb.quantity,
           mb.buying_price,
           mb.selling_price
         FROM medicine_batches mb
         INNER JOIN medicines m
           ON mb.medicine_id = m.id
         WHERE mb.expiry_date > CURRENT_DATE
         ORDER BY mb.expiry_date ASC`,
      );

    return result.rows;
  }
}