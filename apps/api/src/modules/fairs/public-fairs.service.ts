import { Injectable, NotFoundException } from '@nestjs/common';
import {
  FairParticipantStatus,
  FairStatus,
  Prisma,
  ShowcaseAnalyticsType,
  VehicleStatus,
} from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { runWithRlsPublicRead } from '../../prisma/rls-context';
import { StorageService } from '../storage/storage.service';
import { PublicFairVehiclesQueryDto } from './dto/public-fair-vehicles.query.dto';
import { soldDuringFair } from './utils/fair-status';

const PUBLIC_STATUSES: FairStatus[] = [
  FairStatus.PUBLISHED,
  FairStatus.LIVE,
  FairStatus.ENDED,
];

const FAIR_PUBLIC_SELECT = {
  id: true,
  slug: true,
  name: true,
  startsAt: true,
  endsAt: true,
  venue: true,
  address: true,
  description: true,
  status: true,
  organizer: { select: { name: true, slug: true } },
} satisfies Prisma.FairSelect;

function omitId<T extends { id: string }>(row: T): Omit<T, 'id'> {
  const copy: Partial<T> = { ...row };
  delete copy.id;
  return copy as Omit<T, 'id'>;
}

/** Feirão público: só fora de rascunho (RLS `app.public_read`), só campos públicos. */
@Injectable()
export class PublicFairsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Próximos feirões (destaque na vitrine da cidade). */
  async upcoming(now = new Date()) {
    const rows = await runWithRlsPublicRead(() =>
      this.prisma.fair.findMany({
        where: {
          deletedAt: null,
          status: { in: [FairStatus.PUBLISHED, FairStatus.LIVE] },
          endsAt: { gte: now },
        },
        orderBy: { startsAt: 'asc' },
        take: 3,
        select: {
          ...FAIR_PUBLIC_SELECT,
          _count: { select: { vehicles: true } },
        },
      }),
    );
    return rows.map(({ _count, organizer, ...f }) => ({
      ...omitId(f),
      organizer: { name: organizer.name, slug: organizer.slug },
      vehicles: _count.vehicles,
    }));
  }

  async getFair(slug: string) {
    return runWithRlsPublicRead(async () => {
      const fair = await this.prisma.fair.findFirst({
        where: { slug, deletedAt: null, status: { in: PUBLIC_STATUSES } },
        select: FAIR_PUBLIC_SELECT,
      });
      if (!fair) throw new NotFoundException('Feirão não encontrado');
      const [participants, states] = await Promise.all([
        this.prisma.fairParticipant.findMany({
          where: { fairId: fair.id, status: FairParticipantStatus.ACCEPTED },
          select: {
            company: {
              select: {
                name: true,
                slug: true,
                city: true,
                showcaseEnabled: true,
              },
            },
          },
        }),
        this.prisma.fairVehicle.findMany({
          where: {
            fairId: fair.id,
            vehicle: {
              deletedAt: null,
              status: { not: VehicleStatus.ARCHIVED },
              company: { showcaseEnabled: true },
            },
          },
          select: {
            vehicle: { select: { status: true, soldAt: true, make: true } },
          },
        }),
      ]);
      const makes = new Map<string, number>();
      for (const s of states)
        makes.set(s.vehicle.make, (makes.get(s.vehicle.make) ?? 0) + 1);
      return {
        ...omitId(fair),
        stores: participants
          .filter((p) => p.company.showcaseEnabled && p.company.slug)
          .map((p) => ({
            name: p.company.name,
            slug: p.company.slug as string,
            city: p.company.city,
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        counts: {
          vehicles: states.length,
          sold: states.filter(
            (s) =>
              s.vehicle.status === VehicleStatus.SOLD &&
              soldDuringFair(s.vehicle.soldAt, fair),
          ).length,
        },
        makes: [...makes.entries()]
          .map(([make, count]) => ({ make, count }))
          .sort((a, b) => a.make.localeCompare(b.make)),
      };
    });
  }

  /** Carros do feirão, vendidos com faixa "Vendido" (disponíveis primeiro). */
  async vehicles(slug: string, query: PublicFairVehiclesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 48;
    return runWithRlsPublicRead(async () => {
      const fair = await this.prisma.fair.findFirst({
        where: { slug, deletedAt: null, status: { in: PUBLIC_STATUSES } },
        select: { id: true, startsAt: true, endsAt: true },
      });
      if (!fair) throw new NotFoundException('Feirão não encontrado');

      const and: Prisma.VehicleWhereInput[] = [];
      for (const word of (query.q ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 5)) {
        and.push({
          OR: [
            { make: { contains: word, mode: 'insensitive' } },
            { model: { contains: word, mode: 'insensitive' } },
            { version: { contains: word, mode: 'insensitive' } },
          ],
        });
      }
      const where: Prisma.FairVehicleWhereInput = {
        fairId: fair.id,
        ...(query.maxPrice
          ? { priceCentsAtFair: { lte: query.maxPrice * 100 } }
          : {}),
        ...(query.store ? { company: { slug: query.store } } : {}),
        vehicle: {
          deletedAt: null,
          status: query.onlyAvailable
            ? { in: [VehicleStatus.AVAILABLE, VehicleStatus.RESERVED] }
            : { not: VehicleStatus.ARCHIVED },
          company: { showcaseEnabled: true },
          ...(query.make
            ? { make: { equals: query.make, mode: 'insensitive' } }
            : {}),
          ...(and.length ? { AND: and } : {}),
        },
      };

      const rows = await this.prisma.fairVehicle.findMany({
        where,
        select: {
          priceCentsAtFair: true,
          company: { select: { name: true, slug: true } },
          vehicle: {
            select: {
              slug: true,
              showcaseCode: true,
              make: true,
              model: true,
              version: true,
              yearManufacture: true,
              yearModel: true,
              mileageKm: true,
              transmission: true,
              fuel: true,
              status: true,
              soldAt: true,
              photos: {
                orderBy: { sortOrder: 'asc' },
                take: 1,
                select: { storageKey: true },
              },
            },
          },
        },
      });

      // Disponíveis primeiro, depois reservados, vendidos no fim; dentro do grupo, menor preço.
      const rank = (s: VehicleStatus) =>
        s === VehicleStatus.AVAILABLE
          ? 0
          : s === VehicleStatus.RESERVED
            ? 1
            : 2;
      rows.sort(
        (a, b) =>
          rank(a.vehicle.status) - rank(b.vehicle.status) ||
          a.priceCentsAtFair - b.priceCentsAtFair,
      );
      const total = rows.length;
      const slice = rows.slice((page - 1) * limit, page * limit);
      return {
        data: slice.map((r) => ({
          slug: r.vehicle.slug,
          code: r.vehicle.showcaseCode,
          make: r.vehicle.make,
          model: r.vehicle.model,
          version: r.vehicle.version,
          yearManufacture: r.vehicle.yearManufacture,
          yearModel: r.vehicle.yearModel,
          priceCents: r.priceCentsAtFair,
          mileageKm: r.vehicle.mileageKm,
          transmission: r.vehicle.transmission,
          fuel: r.vehicle.fuel,
          status: r.vehicle.status,
          soldDuringFair:
            r.vehicle.status === VehicleStatus.SOLD &&
            soldDuringFair(r.vehicle.soldAt, fair),
          coverUrl: r.vehicle.photos[0]
            ? this.storage.publicUrl(r.vehicle.photos[0].storageKey)
            : null,
          store: {
            name: r.company.name,
            slug: r.company.slug ?? '',
            city: null,
          },
        })),
        meta: {
          page,
          limit,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / limit),
          makes: [],
        },
      };
    });
  }

  /**
   * Leitura do QR: registra a leitura (sem dado pessoal) e diz para onde ir.
   * O código não carrega dado da loja nem do carro; um carro retirado do feirão perde o código.
   */
  async scan(code: string) {
    const fv = await runWithRlsPublicRead(() =>
      this.prisma.fairVehicle.findFirst({
        where: {
          qrCode: code.toUpperCase(),
          fair: { deletedAt: null, status: { in: PUBLIC_STATUSES } },
        },
        select: {
          fairId: true,
          vehicleId: true,
          companyId: true,
          fair: { select: { slug: true } },
        },
      }),
    );
    if (!fv) throw new NotFoundException('Código não encontrado');
    // Carro arquivado ou loja sem vitrine: a leitura leva para a página do feirão.
    const vehicle = await runWithRlsPublicRead(() =>
      this.prisma.vehicle.findFirst({
        where: {
          id: fv.vehicleId,
          deletedAt: null,
          status: { not: VehicleStatus.ARCHIVED },
          company: { showcaseEnabled: true },
        },
        select: { slug: true },
      }),
    );

    await this.prisma.showcaseAnalyticsEvent.create({
      data: {
        type: ShowcaseAnalyticsType.QR_SCAN,
        companyId: fv.companyId,
        vehicleId: fv.vehicleId,
        fairId: fv.fairId,
        // Sem sessão no servidor: cada leitura conta uma vez (hash aleatório).
        sessionHash: createHash('sha256').update(randomUUID()).digest('hex'),
      },
    });

    return { fairSlug: fv.fair.slug, vehicleSlug: vehicle?.slug ?? null };
  }
}
