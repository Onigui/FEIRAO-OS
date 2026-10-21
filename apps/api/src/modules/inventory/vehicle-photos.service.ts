import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import {
  ConfirmVehiclePhotoDto,
  CreatePhotoUploadUrlDto,
  ReorderVehiclePhotosDto,
} from './dto/vehicle-photo.dto';
import {
  AUDIT_TARGET_VEHICLE,
  VEHICLE_MAX_PHOTOS,
  VEHICLE_PHOTO_CONTENT_TYPES,
  VEHICLE_PHOTO_EXTENSIONS,
  VEHICLE_PHOTO_MAX_BYTES,
} from './inventory.constants';
import {
  VehiclesService,
  type CompanyActor,
  type RequestMeta,
  type VehicleResponse,
} from './vehicles.service';

export function vehiclePhotoPrefix(
  companyId: string,
  vehicleId: string,
): string {
  return `vehicles/${companyId}/${vehicleId}/`;
}

/**
 * Fotos: navegador → R2 por URL assinada; a API só registra a chave depois
 * de confirmar no R2 que o objeto existe, com tipo e tamanho permitidos.
 */
@Injectable()
export class VehiclePhotosService {
  private readonly logger = new Logger(VehiclePhotosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly vehicles: VehiclesService,
  ) {}

  async createUploadUrl(
    actor: CompanyActor,
    vehicleId: string,
    dto: CreatePhotoUploadUrlDto,
  ) {
    const vehicle = await this.vehicles.findActive(actor.cid, vehicleId);
    if (vehicle.photos.length >= VEHICLE_MAX_PHOTOS) {
      throw new ConflictException(
        `Limite de ${VEHICLE_MAX_PHOTOS} fotos por veículo`,
      );
    }
    const ext = VEHICLE_PHOTO_EXTENSIONS[dto.contentType];
    const key = `${vehiclePhotoPrefix(actor.cid, vehicle.id)}${randomUUID()}.${ext}`;
    return this.storage.createUploadUrl({
      key,
      contentType: dto.contentType,
      contentLength: dto.sizeBytes,
      maxBytes: VEHICLE_PHOTO_MAX_BYTES,
      allowedContentTypes: VEHICLE_PHOTO_CONTENT_TYPES,
    });
  }

  async confirm(
    actor: CompanyActor,
    vehicleId: string,
    dto: ConfirmVehiclePhotoDto,
    meta?: RequestMeta,
  ): Promise<VehicleResponse> {
    const vehicle = await this.vehicles.findActive(actor.cid, vehicleId);
    const prefix = vehiclePhotoPrefix(actor.cid, vehicle.id);
    const rest = dto.storageKey.startsWith(prefix)
      ? dto.storageKey.slice(prefix.length)
      : '';
    if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(rest)) {
      throw new BadRequestException('Chave de foto inválida para este veículo');
    }
    if (vehicle.photos.some((p) => p.storageKey === dto.storageKey)) {
      return this.vehicles.toResponse(vehicle);
    }
    if (vehicle.photos.length >= VEHICLE_MAX_PHOTOS) {
      throw new ConflictException(
        `Limite de ${VEHICLE_MAX_PHOTOS} fotos por veículo`,
      );
    }

    const head = await this.storage.headObject(dto.storageKey);
    if (!head) {
      throw new BadRequestException(
        'Arquivo não encontrado no armazenamento; envie de novo',
      );
    }
    if (
      head.contentLength <= 0 ||
      head.contentLength > VEHICLE_PHOTO_MAX_BYTES ||
      !head.contentType ||
      !(VEHICLE_PHOTO_CONTENT_TYPES as readonly string[]).includes(
        head.contentType,
      )
    ) {
      await this.safeDelete(dto.storageKey);
      throw new BadRequestException('Arquivo de foto inválido');
    }

    const nextOrder =
      vehicle.photos.length === 0
        ? 0
        : Math.max(...vehicle.photos.map((p) => p.sortOrder)) + 1;

    await this.prisma.$transaction(async (tx) => {
      const photo = await tx.vehiclePhoto.create({
        data: {
          companyId: actor.cid,
          vehicleId: vehicle.id,
          storageKey: dto.storageKey,
          width: dto.width,
          height: dto.height,
          sortOrder: nextOrder,
        },
      });
      await this.audit.write(tx, {
        companyId: actor.cid,
        actorUserId: actor.sub,
        action: 'VEHICLE_PHOTO_ADD',
        targetType: AUDIT_TARGET_VEHICLE,
        targetId: vehicle.id,
        before: null,
        after: { photoId: photo.id, sortOrder: nextOrder },
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });
    });
    return this.vehicles.findOne(actor, vehicle.id);
  }

  async reorder(
    actor: CompanyActor,
    vehicleId: string,
    dto: ReorderVehiclePhotosDto,
  ): Promise<VehicleResponse> {
    const vehicle = await this.vehicles.findActive(actor.cid, vehicleId);
    const current = new Set(vehicle.photos.map((p) => p.id));
    if (
      dto.photoIds.length !== current.size ||
      !dto.photoIds.every((id) => current.has(id))
    ) {
      throw new BadRequestException(
        'Envie todas as fotos do veículo, cada uma uma vez',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      for (const [index, id] of dto.photoIds.entries()) {
        await tx.vehiclePhoto.updateMany({
          where: { id, vehicleId: vehicle.id, companyId: actor.cid },
          data: { sortOrder: index },
        });
      }
    });
    return this.vehicles.findOne(actor, vehicle.id);
  }

  async remove(
    actor: CompanyActor,
    vehicleId: string,
    photoId: string,
    meta?: RequestMeta,
  ): Promise<VehicleResponse> {
    const vehicle = await this.vehicles.findActive(actor.cid, vehicleId);
    const photo = vehicle.photos.find((p) => p.id === photoId);
    if (!photo) throw new NotFoundException('Foto não encontrada');

    await this.prisma.$transaction(async (tx) => {
      await tx.vehiclePhoto.deleteMany({
        where: { id: photo.id, vehicleId: vehicle.id, companyId: actor.cid },
      });
      await this.audit.write(tx, {
        companyId: actor.cid,
        actorUserId: actor.sub,
        action: 'VEHICLE_PHOTO_DELETE',
        targetType: AUDIT_TARGET_VEHICLE,
        targetId: vehicle.id,
        before: { photoId: photo.id },
        after: null,
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });
    });
    await this.safeDelete(photo.storageKey);
    return this.vehicles.findOne(actor, vehicle.id);
  }

  /** Remoção do arquivo é melhor esforço: o registro já saiu do banco. */
  private async safeDelete(key: string): Promise<void> {
    try {
      await this.storage.deleteObject(key);
    } catch (error) {
      this.logger.warn(
        `failed to delete ${key} from storage: ${(error as Error).message}`,
      );
    }
  }
}
