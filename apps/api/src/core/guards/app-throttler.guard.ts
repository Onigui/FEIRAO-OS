import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Limite por IP usando `req.ip`, que respeita TRUST_PROXY_HOPS.
 * (O padrão do Nest usa o primeiro endereço de X-Forwarded-For, que o cliente
 * pode inventar para escapar do limite.)
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const ip = typeof req.ip === 'string' && req.ip ? req.ip : 'unknown';
    return Promise.resolve(ip);
  }
}
