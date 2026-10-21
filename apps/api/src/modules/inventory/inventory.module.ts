import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { InventoryImportController } from './inventory-import.controller';
import { InventoryImportService } from './inventory-import.service';
import { VehiclePhotosService } from './vehicle-photos.service';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';

/** Vitrine e Feirões — estoque de veículos da loja (Company). */
@Module({
  imports: [AuthModule, AuditModule, StorageModule],
  controllers: [VehiclesController, InventoryImportController],
  providers: [VehiclesService, VehiclePhotosService, InventoryImportService],
  exports: [VehiclesService],
})
export class InventoryModule {}
