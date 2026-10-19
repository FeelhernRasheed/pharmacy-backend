import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { requestIdMiddleware } from '../src/common/middleware/request-id.middleware';
import { DatabaseService } from '../src/database/database.service';

async function createApp(
  overrideDatabase = false,
): Promise<INestApplication<App>> {
  const moduleBuilder = Test.createTestingModule({
    imports: [AppModule],
  });

  if (overrideDatabase) {
    moduleBuilder.overrideProvider(DatabaseService).useValue({
      testConnection: jest
        .fn()
        .mockRejectedValue(
          new Error('connect ECONNREFUSED 127.0.0.1:5432'),
        ),
      getPool: jest.fn(),
    });
  }

  const moduleFixture: TestingModule = await moduleBuilder.compile();
  const app = moduleFixture.createNestApplication();
  app.use(requestIdMiddleware);
  await app.init();
  return app;
}

describe('Health checks (e2e)', () => {
  describe('liveness', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      app = await createApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /health/live returns 200 with a minimal body', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/live')
        .expect(200);

      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('readiness (database reachable)', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      app = await createApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /health/ready returns 200 with a minimal body', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(200);

      expect(response.body).toEqual({ status: 'ok' });
    });

    it('does not expose sensitive details on success', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(200);

      const raw = JSON.stringify(response.body);
      expect(raw).not.toContain('password');
      expect(raw).not.toContain('DB_');
      expect(Object.keys(response.body)).toEqual(['status']);
    });
  });

  describe('readiness (database unavailable)', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      app = await createApp(true);
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /health/ready returns 503 with a generic body', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(503);

      expect(response.body).toMatchObject({
        statusCode: 503,
        message: 'Service unavailable',
      });
    });

    it('never leaks connection details to the caller', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(503);

      const raw = JSON.stringify(response.body);
      expect(raw).not.toContain('ECONNREFUSED');
      expect(raw).not.toContain('127.0.0.1');
      expect(raw).not.toContain('5432');
      expect(raw).not.toContain('connect');
    });

    it('liveness still reports 200 while readiness fails', async () => {
      await request(app.getHttpServer())
        .get('/health/live')
        .expect(200);
    });
  });

  describe('request correlation', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      app = await createApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it('echoes a valid X-Request-Id header', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/live')
        .set('X-Request-Id', 'probe-abc-1234')
        .expect(200);

      expect(response.headers['x-request-id']).toBe(
        'probe-abc-1234',
      );
    });

    it('generates a fresh correlation id when the header is missing', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/live')
        .expect(200);

      expect(response.headers['x-request-id']).toMatch(
        /^[0-9a-f-]{36}$/,
      );
    });

    it('replaces a malformed X-Request-Id instead of echoing it', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/live')
        .set('X-Request-Id', 'bad id <script>')
        .expect(200);

      expect(response.headers['x-request-id']).not.toBe(
        'bad id <script>',
      );
      expect(response.headers['x-request-id']).toMatch(
        /^[0-9a-f-]{36}$/,
      );
    });
  });
});
