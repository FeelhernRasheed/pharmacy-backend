import { Logger, ServiceUnavailableException } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let testConnectionMock: jest.Mock;

  beforeEach(async () => {
    testConnectionMock = jest.fn();
    jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation();

    service = new HealthService({
      testConnection: testConnectionMock,
    } as unknown as DatabaseService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('liveness', () => {
    it('reports ok without touching the database', () => {
      expect(service.liveness()).toEqual({ status: 'ok' });
      expect(testConnectionMock).not.toHaveBeenCalled();
    });
  });

  describe('readiness', () => {
    it('reports ok when the database is reachable', async () => {
      testConnectionMock.mockResolvedValue(true);

      await expect(service.readiness()).resolves.toEqual({
        status: 'ok',
      });
      expect(testConnectionMock).toHaveBeenCalledTimes(1);
    });

    it('throws 503 without leaking details when the database is down', async () => {
      testConnectionMock.mockRejectedValue(
        new Error('connect ECONNREFUSED 127.0.0.1:5432'),
      );

      await expect(service.readiness()).rejects.toThrow(
        ServiceUnavailableException,
      );

      try {
        await service.readiness();
      } catch (error) {
        const body = (
          error as ServiceUnavailableException
        ).getResponse();
        expect(JSON.stringify(body)).not.toContain(
          'ECONNREFUSED',
        );
        expect(JSON.stringify(body)).not.toContain('127.0.0.1');
        expect(JSON.stringify(body)).not.toContain('5432');
        expect(body).toMatchObject({
          statusCode: 503,
          message: 'Service unavailable',
        });
      }
    });

    it('logs the failure server-side once per call', async () => {
      testConnectionMock.mockRejectedValue(
        new Error('connection terminated'),
      );
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');

      await expect(service.readiness()).rejects.toThrow();

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain(
        'Readiness check failed',
      );
    });
  });
});
