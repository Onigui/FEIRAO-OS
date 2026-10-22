import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../shared/redis/redis.service';
import { ShowcaseRetentionService } from './showcase-retention.service';

const INTERVAL_MS = 6 * 60 * 60 * 1000; // 4 vezes por dia; cada rodada processa um lote.
const LOCK_KEY = 'showcase:retention:lock';

/** Roda a anonimização periodicamente quando SHOWCASE_RETENTION_ENABLED=true. */
@Injectable()
export class ShowcaseRetentionScanner implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ShowcaseRetentionScanner.name);
  private readonly enabled: boolean;
  private readonly months: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly retention: ShowcaseRetentionService,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.enabled =
      config.get<boolean>('showcase.retentionEnabled', false) === true;
    this.months = config.get<number>('showcase.retentionMonths', 12);
  }

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log(
        'showcase retention disabled (SHOWCASE_RETENTION_ENABLED=false)',
      );
      return;
    }
    this.logger.log(`showcase retention enabled months=${this.months}`);
    this.timer = setInterval(() => void this.tick(), INTERVAL_MS);
    setTimeout(() => void this.tick(), 30_000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(): Promise<void> {
    const token = await this.redis.tryAcquireLock(LOCK_KEY, 10 * 60 * 1000);
    if (!token) return;
    try {
      await this.retention.run(new Date(), this.months);
    } catch (err) {
      this.logger.warn(
        `showcase retention failed: ${err instanceof Error ? err.message : err}`,
      );
    } finally {
      await this.redis.releaseLock(LOCK_KEY, token);
    }
  }
}
