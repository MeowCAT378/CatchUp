import { HttpStatus } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports liveness without touching PostgreSQL', () => {
    const query = jest.fn();
    const controller = new HealthController({ $queryRaw: query } as never);

    expect(controller.live()).toEqual({ status: 'ok' });
    expect(query).not.toHaveBeenCalled();
  });

  it('reports readiness after PostgreSQL responds', async () => {
    const query = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    const controller = new HealthController({ $queryRaw: query } as never);

    await expect(controller.ready()).resolves.toEqual({ status: 'ready' });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('reports a normalized service-unavailable error when PostgreSQL fails', async () => {
    const query = jest.fn().mockRejectedValue(new Error('database offline'));
    const controller = new HealthController({ $queryRaw: query } as never);

    await expect(controller.ready()).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
  });
});
