import {
  Injectable,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

@Injectable()
export class LowStockService {
  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

  async getLowStock(threshold: number = 20) {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           mb.id,
           mb.batch_number,
           mb.medicine_id,
           m.name AS medicine_name,
           m.strength,
           mb.quantity,
           mb.expiry_date,
           mb.buying_price,
           mb.selling_price
         FROM medicine_batches mb
         INNER JOIN medicines m
           ON mb.medicine_id = m.id
         WHERE mb.quantity < $1
         ORDER BY mb.quantity ASC`,
        [threshold],
      );

    return result.rows;
  }
}