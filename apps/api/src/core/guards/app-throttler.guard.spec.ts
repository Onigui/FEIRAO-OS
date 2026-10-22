import { AppThrottlerGuard } from './app-throttler.guard';

describe('AppThrottlerGuard', () => {
  const guard = Object.create(
    AppThrottlerGuard.prototype,
  ) as AppThrottlerGuard & {
    getTracker(req: Record<string, unknown>): Promise<string>;
  };

  it('usa req.ip (já resolvido pelo trust proxy), não o primeiro X-Forwarded-For', async () => {
    await expect(
      guard.getTracker({ ip: '203.0.113.7', ips: ['1.2.3.4', '203.0.113.7'] }),
    ).resolves.toBe('203.0.113.7');
  });

  it('sem IP: agrupa como unknown', async () => {
    await expect(guard.getTracker({})).resolves.toBe('unknown');
  });
});
