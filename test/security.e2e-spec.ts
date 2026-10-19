import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import helmet from 'helmet';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

// Mirrors the production bootstrap setup from src/main.ts
// (helmet options, ValidationPipe, exception filter).
async function createSecuredApp(): Promise<INestApplication<App>> {
  const moduleFixture: TestingModule = await Test.createTestingModule(
    {
      imports: [AppModule],
    },
  ).compile();

  const app = moduleFixture.createNestApplication();

  app
    .getHttpAdapter()
    .getInstance()
    .disable('x-powered-by');

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

// Rate-limit values come from test/setup-e2e-env.ts, which runs
// before AppModule is imported (ConfigModule.forRoot evaluates and
// validates the environment at import time).
describe('Application security (e2e)', () => {
  describe('HTTP security headers and input validation', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      app = await createSecuredApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it('sets hardened HTTP headers on responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe(
        'nosniff',
      );
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['content-security-policy']).toContain(
        "default-src 'self'",
      );
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('rejects a request body with missing login fields', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({})
        .expect(400);
    });

    it('rejects unexpected properties in the request body', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'someone',
          password: 'irrelevant',
          role: 'ADMIN',
        })
        .expect(400);

      // The smuggled privilege-escalation style field must be named
      // in the validation error, proving it was rejected not ignored.
      expect(JSON.stringify(response.body)).toContain('role');
    });
  });

  describe('Rate limiting', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      app = await createSecuredApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it('returns 429 once the global per-IP limit is exceeded', async () => {
      // RATE_LIMIT_MAX=10 from setup-e2e-env.ts
      for (let i = 0; i < 10; i++) {
        await request(app.getHttpServer())
          .get('/hello')
          .expect(200);
      }

      await request(app.getHttpServer())
        .get('/hello')
        .expect(429);
    });

    it('applies a stricter limit to /auth/login', async () => {
      // AUTH_RATE_LIMIT_MAX=3 from setup-e2e-env.ts. Invalid bodies
      // still pass through the throttler guard (guards run before
      // pipes), so these attempts count toward the login limit
      // without requiring a database round-trip.
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({})
          .expect(400);
      }

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({})
        .expect(429);
    });
  });

  describe('Reverse-proxy trust', () => {
    it('ignores X-Forwarded-For by default (buckets cannot be spoofed)', async () => {
      const app = await createSecuredApp();
      try {
        // RATE_LIMIT_MAX=10; exhaust the real client's bucket.
        for (let i = 0; i < 10; i++) {
          await request(app.getHttpServer())
            .get('/hello')
            .expect(200);
        }

        // A forged forwarded header must NOT open a fresh bucket
        // while TRUST_PROXY is unset.
        await request(app.getHttpServer())
          .get('/hello')
          .set('X-Forwarded-For', '203.0.113.9')
          .expect(429);
      } finally {
        await app.close();
      }
    });

    it('honours X-Forwarded-For only when trust proxy is configured', async () => {
      const app = await createSecuredApp();
      try {
        // Mirrors applyTrustProxy() with a hop count of 1, i.e. a
        // single trusted reverse proxy in front of the app.
        app.getHttpAdapter().getInstance().set('trust proxy', 1);

        // Exhaust the direct client's bucket.
        for (let i = 0; i < 10; i++) {
          await request(app.getHttpServer())
            .get('/hello')
            .expect(200);
        }

        // With the proxy hop trusted, the forwarded client IP is
        // used as the tracker, so it gets its own bucket.
        await request(app.getHttpServer())
          .get('/hello')
          .set('X-Forwarded-For', '203.0.113.9')
          .expect(200);
      } finally {
        await app.close();
      }
    });
  });
});
