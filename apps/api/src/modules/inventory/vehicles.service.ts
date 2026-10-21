import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  MembershipRole,
  Prisma,
  Vehicle,
  VehiclePhoto,
  VehicleStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { StorageService } from '../storage/storage.service';
import { CreateVehicleDto } from './dto/vehicle-fields.dto';
import { ListVehiclesQueryDto } from './dto/list-vehicles.query.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { AUDIT_TARGET_VEHICLE, VEHICLE_YEAR_MIN } from './inventory.constants';
import { buildVehicleSlug, generateShortCode } from './utils/codes';
import { checkVehicleStatusTransition } from './utils/vehicle-status';

export type CompanyActor = AuthenticatedUser & {
  cid: string;
  sub: string;
  role: MembershipRole;
};

export type RequestMeta = { ip?: string; userAgent?: string };

export type VehiclePhotoResponse = {
  id: string;
  url: string | null;
  width: number;
  height: number;
  sortOrder: number;
};

export type VehicleResponse = {
  id: string;
  slug: string;
  showcaseCode: string;
  make: string;
  model: string;
  version: string | null;
  yearManufacture: number;
  yearModel: number;
  priceCents: number;
  mileageKm: number;
  transmission: Vehicle['transmission'];
  fuel: Vehicle['fuel'];
  bodyType: string | null;
  color: string | null;
  description: string | null;
  status: VehicleStatus;
  soldAt: Date | null;
  coverUrl: string | null;
  photos: VehiclePhotoResponse[];
  createdAt: Date;
  updatedAt: Date;
};

type VehicleWithPhotos = Vehicle & { photos: VehiclePhoto[] };

const PHOTOS_ORDERED = { photos: { orderBy: { sortOrder: 'asc' as const } } };

/** Tentativas para gerar slug/código único em caso de colisão. */
const UNIQUE_RETRIES = 3;

@Injectable()
export class VehiclesService {
  private readonly logger = new Logger(VehiclesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  async list(actor: CompanyActor, query: ListVehiclesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;
    const where: Prisma.VehicleWhereInput = { companyId: actor.cid };

    if (query.status) {
      where.status = query.status;
    } else if (!query.includeArchived) {
      where.status = { not: VehicleStatus.ARCHIVED };
    }
    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { make: { contains: term, mode: 'insensitive' } },
        { model: { contains: term, mode: 'insensitive' } },
        { version: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.vehicle.count({ where }),
      this.prisma.vehicle.findMany({
        where,
        include: PHOTOS_ORDERED,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows.map((row) => this.toResponse(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async findOne(actor: CompanyActor, id: string): Promise<VehicleResponse> {
    return this.toResponse(await this.findActive(actor.cid, id));
  }

  async create(
    actor: CompanyActor,
    dto: CreateVehicleDto,
    meta?: RequestMeta,
  ): Promise<VehicleResponse> {
    this.assertYears(dto.yearManufacture, dto.yearModel);

    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const vehicle = await tx.vehicle.create({
            data: this.createData(actor, dto),
            include: PHOTOS_ORDERED,
          });
          await this.audit.write(tx, {
            companyId: actor.cid,
            actorUserId: actor.sub,
            action: 'VEHICLE_CREATE',
            targetType: AUDIT_TARGET_VEHICLE,
            targetId: vehicle.id,
            before: null,
            after: this.snapshot(vehicle),
            ip: meta?.ip,
            userAgent: meta?.userAgent,
          });
          return this.toResponse(vehicle);
        });
      } catch (error) {
        if (this.isUniqueViolation(error) && attempt < UNIQUE_RETRIES) continue;
        throw error;
      }
    }
  }

  /** Usado pela importação: cria vários dentro de uma transação já aberta. */
  createData(
    actor: CompanyActor,
    dto: CreateVehicleDto,
  ): Prisma.VehicleUncheckedCreateInput {
    return {
      companyId: actor.cid,
      slug: buildVehicleSlug(dto),
      showcaseCode: generateShortCode(8),
      make: dto.make,
      model: dto.model,
      version: dto.version ?? null,
      yearManufacture: dto.yearManufacture,
      yearModel: dto.yearModel,
      priceCents: dto.priceCents,
      mileageKm: dto.mileageKm,
      transmission: dto.transmission,
      fuel: dto.fuel,
      bodyType: dto.bodyType ?? null,
      color: dto.color ?? null,
      description: dto.description ?? null,
      status: VehicleStatus.AVAILABLE,
      createdById: actor.sub,
    };
  }

  async update(
    actor: CompanyActor,
    id: string,
    dto: UpdateVehicleDto,
    meta?: RequestMeta,
  ): Promise<VehicleResponse> {
    const existing = await this.findActive(actor.cid, id);
    this.assertYears(
      dto.yearManufacture ?? existing.yearManufacture,
      dto.yearModel ?? existing.yearModel,
    );

    const data: Prisma.VehicleUpdateInput = {};
    if (dto.make !== undefined) data.make = dto.make;
    if (dto.model !== undefined) data.model = dto.model;
    if (dto.version !== undefined) data.version = dto.version;
    if (dto.yearManufacture !== undefined)
      data.yearManufacture = dto.yearManufacture;
    if (dto.yearModel !== undefined) data.yearModel = dto.yearModel;
    if (dto.priceCents !== undefined) data.priceCents = dto.priceCents;
    if (dto.mileageKm !== undefined) data.mileageKm = dto.mileageKm;
    if (dto.transmission !== undefined) data.transmission = dto.transmission;
    if (dto.fuel !== undefined) data.fuel = dto.fuel;
    if (dto.bodyType !== undefined) data.bodyType = dto.bodyType;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.description !== undefined) data.description = dto.description;

    if (Object.keys(data).length === 0) {
      return this.toResponse(existing);
    }

    return this.prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.update({
        where: { id: existing.id },
        data,
        include: PHOTOS_ORDERED,
      });
      await this.audit.write(tx, {
        companyId: actor.cid,
        actorUserId: actor.sub,
        action: 'VEHICLE_UPDATE',
        targetType: AUDIT_TARGET_VEHICLE,
        targetId: vehicle.id,
        before: this.snapshot(existing),
        after: this.snapshot(vehicle),
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });
      return this.toResponse(vehicle);
    });
  }

  async changeStatus(
    actor: CompanyActor,
    id: string,
    toStatus: VehicleStatus,
    meta?: RequestMeta,
  ): Promise<VehicleResponse> {
    const existing = await this.findActive(actor.cid, id);
    const now = new Date();
    const check = checkVehicleStatusTransition({
      from: existing.status,
      to: toStatus,
      role: actor.role,
      soldAt: existing.soldAt,
      now,
    });
    if (!check.ok) {
      if (check.code === 'ROLE') throw new ForbiddenException(check.message);
      throw new ConflictException({
        code: `VEHICLE_STATUS_${check.code}`,
        message: check.message,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      // Guarda contra corrida: só muda se o status ainda for o lido.
      const updated = await tx.vehicle.updateMany({
        where: {
          id: existing.id,
          companyId: actor.cid,
          status: existing.status,
        },
        data: {
          status: toStatus,
          soldAt:
            toStatus === VehicleStatus.SOLD
              ? now
              : toStatus === VehicleStatus.AVAILABLE
                ? null
                : existing.soldAt,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException({
          code: 'VEHICLE_STATUS_CHANGED',
          message: 'O status do veículo mudou; recarregue e tente de novo',
        });
      }
      await tx.vehicleStatusTransition.create({
        data: {
          companyId: actor.cid,
          vehicleId: existing.id,
          fromStatus: existing.status,
          toStatus,
          actorUserId: actor.sub,
          occurredAt: now,
        },
      });
      await this.audit.write(tx, {
        companyId: actor.cid,
        actorUserId: actor.sub,
        action: 'VEHICLE_STATUS_CHANGE',
        targetType: AUDIT_TARGET_VEHICLE,
        targetId: existing.id,
        before: { status: existing.status },
        after: { status: toStatus },
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });
      const vehicle = await tx.vehicle.findFirstOrThrow({
        where: { id: existing.id, companyId: actor.cid },
        include: PHOTOS_ORDERED,
      });
      return this.toResponse(vehicle);
    });
  }

  async statusHistory(actor: CompanyActor, id: string) {
    const vehicle = await this.findActive(actor.cid, id);
    const rows = await this.prisma.vehicleStatusTransition.findMany({
      where: { companyId: actor.cid, vehicleId: vehicle.id },
      orderBy: { occurredAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => ({
      id: r.id,
      fromStatus: r.fromStatus,
      toStatus: r.toStatus,
      actorUserId: r.actorUserId,
      occurredAt: r.occurredAt,
    }));
  }

  /** Exclusão lógica (OWNER/ADMIN). Fotos ficam no R2 até a limpeza da etapa 5. */
  async remove(
    actor: CompanyActor,
    id: string,
    meta?: RequestMeta,
  ): Promise<void> {
    const existing = await this.findActive(actor.cid, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.vehicle.update({
        where: { id: existing.id },
        data: { deletedAt: new Date() },
      });
      await this.audit.write(tx, {
        companyId: actor.cid,
        actorUserId: actor.sub,
        action: 'VEHICLE_DELETE',
        targetType: AUDIT_TARGET_VEHICLE,
        targetId: existing.id,
        before: this.snapshot(existing),
        after: null,
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });
    });
  }

  async findActive(companyId: string, id: string): Promise<VehicleWithPhotos> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, companyId, deletedAt: null },
      include: PHOTOS_ORDERED,
    });
    if (!vehicle) throw new NotFoundException('Veículo não encontrado');
    return vehicle;
  }

  assertYears(yearManufacture: number, yearModel: number): void {
    const maxYear = new Date().getFullYear() + 1;
    if (
      yearManufacture < VEHICLE_YEAR_MIN ||
      yearManufacture > maxYear ||
      yearModel < VEHICLE_YEAR_MIN ||
      yearModel > maxYear
    ) {
      throw new BadRequestException(
        `Ano deve estar entre ${VEHICLE_YEAR_MIN} e ${maxYear}`,
      );
    }
    if (yearModel < yearManufacture || yearModel > yearManufacture + 1) {
      throw new BadRequestException(
        'Ano do modelo deve ser igual ou 1 a mais que o ano de fabricação',
      );
    }
  }

  toResponse(vehicle: VehicleWithPhotos): VehicleResponse {
    const photos = vehicle.photos.map((p) => ({
      id: p.id,
      url: this.photoUrl(p.storageKey),
      width: p.width,
      height: p.height,
      sortOrder: p.sortOrder,
    }));
    return {
      id: vehicle.id,
      slug: vehicle.slug,
      showcaseCode: vehicle.showcaseCode,
      make: vehicle.make,
      model: vehicle.model,
      version: vehicle.version,
      yearManufacture: vehicle.yearManufacture,
      yearModel: vehicle.yearModel,
      priceCents: vehicle.priceCents,
      mileageKm: vehicle.mileageKm,
      transmission: vehicle.transmission,
      fuel: vehicle.fuel,
      bodyType: vehicle.bodyType,
      color: vehicle.color,
      description: vehicle.description,
      status: vehicle.status,
      soldAt: vehicle.soldAt,
      coverUrl: photos[0]?.url ?? null,
      photos,
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,
    };
  }

  private photoUrl(key: string): string | null {
    if (!this.storage.isConfigured()) return null;
    try {
      return this.storage.publicUrl(key);
    } catch (error) {
      this.logger.warn(`invalid photo key ${key}: ${(error as Error).message}`);
      return null;
    }
  }

  private snapshot(v: Vehicle): Prisma.InputJsonValue {
    return {
      make: v.make,
      model: v.model,
      version: v.version,
      yearManufacture: v.yearManufacture,
      yearModel: v.yearModel,
      priceCents: v.priceCents,
      mileageKm: v.mileageKm,
      transmission: v.transmission,
      fuel: v.fuel,
      status: v.status,
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
