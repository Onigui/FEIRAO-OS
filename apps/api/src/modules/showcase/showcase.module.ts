import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { PublicShowcaseController } from './public-showcase.controller';
import { PublicShowcaseService } from './public-showcase.service';
import { ShowcaseAnalyticsService } from './showcase-analytics.service';
import { ShowcaseInterestService } from './showcase-interest.service';
import { ShowcasePanelController } from './showcase-panel.controller';
import { ShowcasePanelService } from './showcase-panel.service';
import { ShowcaseRetentionScanner } from './showcase-retention.scanner';
import { ShowcaseRetentionService } from './showcase-retention.service';

/** Vitrine e Feirões — vitrine pública, contatos → Lead e números da vitrine. */
@Module({
  imports: [AuthModule, AuditModule, StorageModule],
  controllers: [PublicShowcaseController, ShowcasePanelController],
  providers: [
    PublicShowcaseService,
    ShowcaseInterestService,
    ShowcaseAnalyticsService,
    ShowcasePanelService,
    ShowcaseRetentionService,
    ShowcaseRetentionScanner,
  ],
  exports: [ShowcaseRetentionService],
})
export class ShowcaseModule {}
