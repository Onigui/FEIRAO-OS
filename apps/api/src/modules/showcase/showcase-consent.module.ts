import { Global, Module } from '@nestjs/common';
import { ShowcaseConsentService } from './showcase-consent.service';

/**
 * Global para que recuperação, outbound e follow-up consultem o bloqueio
 * sem depender do módulo público da vitrine (evita ciclos de import).
 */
@Global()
@Module({
  providers: [ShowcaseConsentService],
  exports: [ShowcaseConsentService],
})
export class ShowcaseConsentModule {}
