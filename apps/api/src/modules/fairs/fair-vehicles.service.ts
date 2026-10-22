import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Fair,
  FairParticipantStatus,
  FairStatus,
  Prisma,
  VehicleStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { runWithRlsPublicRead } from '../../prisma/rls-context';
import { AuditService } from '../audit/audit.service';
import type { CompanyActor } from '../inventory/vehicles.service';
import { generateShortCode } from '../inventory/utils/codes';
import { StorageService } from '../storage/storage.service';
import { AddFairVehiclesDto, UpdateFairVehicleDto } from './dto/fair.dto';
import {
  FAIR_VEHICLE_REMOVE,
  FAIR_VEHICLE_UPDATE,
  FAIR_VEHICLES_ADD,
} from './fairs.constants';
import { FairsService } from './fairs.service';
import { isFairFrozen, soldDuringFair } from './utils/fair-status';

type RequestMeta = { ip?: string; userAgent?: string };

const ELIGIBLE: VehicleStatus[] = [
  VehicleStatus.AVAILABLE,
  VehicleStatus.RESERVED,
];
const QR_RETRIES = 5;

const VEHICLE_FIELDS = {
  id: true,
  slug: true,
  showcaseCode: true,
  make: true,
  model: true,
  version: true,
  yearManufacture: true,
  yearModel: true,
  priceCents: true,
  mileageKm: true,
  status: true,
  soldAt: true,
} satisfies Prisma.VehicleSelect;

/** Carros do feirão: só loja que aceitou, só carro próprio, disponível ou reservado. */
@Injectable()
export class FairVehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly fairs: FairsService,
    private readonly storage: StorageService,
  ) {}

  /** Meus carros no feirão + carros do estoque que ainda podem entrar. */
  async mine(actor: CompanyActor, fairId: string) {
    const fair = await this.fairs.findVisible(actor, fairId);
    const inFair = await this.prisma.fairVehicle.findMany({
      where: { fairId, companyId: actor.cid },
      orderBy: { addedAt: 'asc' },
      include: {
        vehicle: {
          select: {
            ...VEHICLE_FIELDS,
            photos: { orderBy: { sortOrder: 'asc' }, take: 1 },
          },
        },
      },
    });
    const inFairIds = inFair.map((fv) => fv.vehicleId);
    const candidates = await this.prisma.vehicle.findMany({
      where: {
        companyId: actor.cid,
        deletedAt: null,
        status: { in: ELIGIBLE },
        id: { notIn: inFairIds },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: VEHICLE_FIELDS,
    });
    return {
      frozen: isFairFrozen(fair.status),
      vehicles: inFair.map((fv) => this.toItem(fair, fv)),
      candidates,
    };
  }

  async add(
    actor: CompanyActor,
    fairId: string,
    dto: AddFairVehiclesDto,
    meta?: RequestMeta,
  ) {
    const fair = await this.assertCanManage(actor, fairId);
    const ids = [...new Set(dto.vehicleIds)];
    const vehicles = await this.prisma.vehicle.findMany({
      where: { id: { in: ids }, companyId: actor.cid, deletedAt: null },
      select: { id: true, status: true, priceCents: true },
    });
    if (vehicles.length !== ids.length) {
      throw new BadRequestException('Carro não encontrado no seu estoque.');
    }
    const blocked = vehicles.filter((v) => !ELIGIBLE.includes(v.status));
    if (blocked.length) {
      throw new ConflictException({
        code: 'VEHICLE_NOT_ELIGIBLE',
        message: 'Só carros disponíveis ou reservados entram no feirão.',
      });
    }
    const already = await this.prisma.fairVehicle.findMany({
      where: { fairId, vehicleId: { in: ids } },
      select: { vehicleId: true },
    });
    const skip = new Set(already.map((a) => a.vehicleId));
    const toAdd = vehicles.filter((v) => !skip.has(v.id));

    for (let attempt = 1; ; attempt += 1) {
      try {
        await this.prisma.$transaction(async (tx) => {
          for (const v of toAdd) {
            await tx.fairVehicle.create({
              data: {
                fairId,
                vehicleId: v.id,
                companyId: actor.cid,
                organizerCompanyId: fair.companyId,
                priceCentsAtFair: v.priceCents,
                // Código novo por inscrição: nunca reaproveitado, sem dado da loja nem do carro.
                qrCode: generateShortCode(8),
              },
            });
          }
          await this.audit.write(tx, {
            companyId: actor.cid,
            actorUserId: actor.sub,
            action: FAIR_VEHICLES_ADD,
            targetType: 'FAIR',
            targetId: fairId,
            before: null,
            after: { vehicleIds: toAdd.map((v) => v.id) },
            ip: meta?.ip,
            userAgent: meta?.userAgent,
          });
        });
        break;
      } catch (error) {
        const unique =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002';
        if (unique && attempt < QR_RETRIES) continue;
        throw error;
      }
    }
    return {
      added: toAdd.length,
      skipped: ids.length - toAdd.length,
      ...(await this.mine(actor, fairId)),
    };
  }

  async updatePrice(
    actor: CompanyActor,
    fairId: string,
    fairVehicleId: string,
    dto: UpdateFairVehicleDto,
    meta?: RequestMeta,
  ) {
    await this.assertCanManage(actor, fairId);
    const fv = await this.findMine(actor, fairId, fairVehicleId);
    await this.prisma.$transaction(async (tx) => {
      await tx.fairVehicle.update({
        where: { id: fv.id },
        data: { priceCentsAtFair: dto.priceCentsAtFair },
      });
      await this.audit.write(tx, {
        companyId: actor.cid,
        actorUserId: actor.sub,
        action: FAIR_VEHICLE_UPDATE,
        targetType: 'FAIR_VEHICLE',
        targetId: fv.id,
        before: { priceCentsAtFair: fv.priceCentsAtFair },
        after: { priceCentsAtFair: dto.priceCentsAtFair },
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });
    });
    return this.mine(actor, fairId);
  }

  async remove(
    actor: CompanyActor,
    fairId: string,
    fairVehicleId: string,
    meta?: RequestMeta,
  ) {
    await this.assertCanManage(actor, fairId);
    const fv = await this.findMine(actor, fairId, fairVehicleId);
    await this.prisma.$transaction(async (tx) => {
      await tx.fairVehicle.delete({ where: { id: fv.id } });
      await this.audit.write(tx, {
        companyId: actor.cid,
        actorUserId: actor.sub,
        action: FAIR_VEHICLE_REMOVE,
        targetType: 'FAIR_VEHICLE',
        targetId: fv.id,
        before: { vehicleId: fv.vehicleId, qrCode: fv.qrCode },
        after: null,
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });
    });
    return this.mine(actor, fairId);
  }

  /** Modo evento: meus carros com status na hora + contadores do feirão inteiro. */
  async live(actor: CompanyActor, fairId: string) {
    const fair = await this.fairs.findVisible(actor, fairId);
    const mineList = await this.mine(actor, fairId);
    const isOrganizer = fair.companyId === actor.cid;

    // Totais do feirão: organizador lê tudo; convidada vê o mesmo que o público.
    const all = await (isOrganizer || fair.status === FairStatus.DRAFT
      ? this.loadFairVehicleStates(fairId, false)
      : runWithRlsPublicRead(() => this.loadFairVehicleStates(fairId, true)));
    const soldInFair = all.filter(
      (r) =>
        soldDuringFair(r.vehicle.soldAt, fair) &&
        r.vehicle.status === VehicleStatus.SOLD,
    );

    const myVehicles = mineList.vehicles;
    return {
      fair: {
        id: fair.id,
        name: fair.name,
        slug: fair.slug,
        status: fair.status,
        startsAt: fair.startsAt,
        endsAt: fair.endsAt,
      },
      counters: {
        fairVehicles: all.length,
        fairSold: soldInFair.length,
        fairAvailable: all.filter(
          (r) => r.vehicle.status === VehicleStatus.AVAILABLE,
        ).length,
        myVehicles: myVehicles.length,
        mySold: myVehicles.filter((v) => v.soldDuringFair).length,
      },
      vehicles: myVehicles,
    };
  }

  /** Cartões de QR para imprimir: os meus; o organizador pode pedir os de todas as lojas. */
  async qrCards(actor: CompanyActor, fairId: string, all: boolean) {
    const fair = await this.fairs.findVisible(actor, fairId);
    const wantAll = all && fair.companyId === actor.cid;
    const rows = await this.prisma.fairVehicle.findMany({
      where: { fairId, ...(wantAll ? {} : { companyId: actor.cid }) },
      orderBy: [{ companyId: 'asc' }, { addedAt: 'asc' }],
      include: {
        vehicle: { select: VEHICLE_FIELDS },
        company: { select: { name: true } },
      },
    });
    return {
      fair: {
        id: fair.id,
        name: fair.name,
        slug: fair.slug,
        startsAt: fair.startsAt,
        venue: fair.venue,
      },
      cards: rows.map((r) => ({
        fairVehicleId: r.id,
        qrCode: r.qrCode,
        storeName: r.company.name,
        make: r.vehicle.make,
        model: r.vehicle.model,
        version: r.vehicle.version,
        yearManufacture: r.vehicle.yearManufacture,
        yearModel: r.vehicle.yearModel,
        mileageKm: r.vehicle.mileageKm,
        priceCentsAtFair: r.priceCentsAtFair,
        showcaseCode: r.vehicle.showcaseCode,
      })),
    };
  }

  /** `publicOnly`: lê só o que o público vê (loja com vitrine ativa, carro não arquivado). */
  private loadFairVehicleStates(fairId: string, publicOnly: boolean) {
    return this.prisma.fairVehicle.findMany({
      where: {
        fairId,
        ...(publicOnly
          ? {
              vehicle: {
                deletedAt: null,
                status: { not: VehicleStatus.ARCHIVED },
                company: { showcaseEnabled: true },
              },
            }
          : {}),
      },
      select: {
        companyId: true,
        vehicle: { select: { status: true, soldAt: true } },
      },
    });
  }

  private async assertCanManage(
    actor: CompanyActor,
    fairId: string,
  ): Promise<Fair> {
    const fair = await this.fairs.findVisible(actor, fairId);
    if (isFairFrozen(fair.status)) {
      throw new ConflictException({
        code: 'FAIR_ENDED',
        message: 'Feirão encerrado: a lista de carros está congelada.',
      });
    }
    const p = await this.prisma.fairParticipant.findFirst({
      where: { fairId, companyId: actor.cid },
      select: { status: true },
    });
    if (p?.status !== FairParticipantStatus.ACCEPTED) {
      throw new ForbiddenException(
        'Aceite o convite antes de inscrever carros.',
      );
    }
    return fair;
  }

  private async findMine(
    actor: CompanyActor,
    fairId: string,
    fairVehicleId: string,
  ) {
    const fv = await this.prisma.fairVehicle.findFirst({
      where: { id: fairVehicleId, fairId, companyId: actor.cid },
    });
    if (!fv) throw new NotFoundException('Carro do feirão não encontrado.');
    return fv;
  }

  private toItem(
    fair: Fair,
    fv: Prisma.FairVehicleGetPayload<{
      include: {
        vehicle: {
          select: typeof VEHICLE_FIELDS & {
            photos: { orderBy: { sortOrder: 'asc' }; take: 1 };
          };
        };
      };
    }>,
  ) {
    const cover = fv.vehicle.photos[0];
    return {
      fairVehicleId: fv.id,
      qrCode: fv.qrCode,
      priceCentsAtFair: fv.priceCentsAtFair,
      addedAt: fv.addedAt,
      soldDuringFair:
        soldDuringFair(fv.vehicle.soldAt, fair) &&
        fv.vehicle.status === VehicleStatus.SOLD,
      coverUrl: cover ? this.storage.publicUrl(cover.storageKey) : null,
      vehicle: {
        id: fv.vehicle.id,
        slug: fv.vehicle.slug,
        showcaseCode: fv.vehicle.showcaseCode,
        make: fv.vehicle.make,
        model: fv.vehicle.model,
        version: fv.vehicle.version,
        yearManufacture: fv.vehicle.yearManufacture,
        yearModel: fv.vehicle.yearModel,
        priceCents: fv.vehicle.priceCents,
        mileageKm: fv.vehicle.mileageKm,
        status: fv.vehicle.status,
        soldAt: fv.vehicle.soldAt,
      },
    };
  }
}
