import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { FairReportService } from './fair-report.service';
import { FairVehiclesService } from './fair-vehicles.service';
import { FairsController } from './fairs.controller';
import { FairsService } from './fairs.service';
import { PublicFairsController } from './public-fairs.controller';
import { PublicFairsService } from './public-fairs.service';

/** Vitrine e Feirões — feirões entre lojas (etapa 4). */
@Module({
  imports: [AuthModule, AuditModule, StorageModule],
  controllers: [FairsController, PublicFairsController],
  providers: [
    FairsService,
    FairVehiclesService,
    FairReportService,
    PublicFairsService,
  ],
})
export class FairsModule {}
