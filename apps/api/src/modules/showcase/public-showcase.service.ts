import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, VehicleStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { runWithRlsPublicRead } from '../../prisma/rls-context';
import { StorageService } from '../storage/storage.service';
import { ListPublicVehiclesQueryDto } from './dto/list-public-vehicles.query.dto';
import { SHOWCASE_LISTED_STATUSES } from './showcase.constants';
import { toLeadPhone } from './utils/phone';

export type PublicStore = {
  slug: string;
  name: string;
  city: string | null;
  address: string | null;
  /** Só dígitos, com 55. */
  whatsapp: string | null;
};

export type PublicVehicleCard = {
  slug: string;
  code: string;
  make: string;
  model: string;
  version: string | null;
  yearManufacture: number;
  yearModel: number;
  priceCents: number;
  mileageKm: number;
  transmission: string;
  fuel: string;
  status: VehicleStatus;
  coverUrl: string | null;
  store: Pick<PublicStore, 'slug' | 'name' | 'city'>;
};

export type PublicVehicleDetail = PublicVehicleCard & {
  bodyType: string | null;
  color: string | null;
  description: string | null;
  photos: { url: string; width: number; height: number }[];
  store: PublicStore;
};

const STORE_SELECT = {
  id: true,
  slug: true,
  name: true,
  city: true,
  publicAddress: true,
  publicWhatsapp: true,
} satisfies Prisma.CompanySelect;

/** Loja publicada: vitrine ativa, ativa no sistema e com endereço da vitrine. */
const PUBLISHED_COMPANY: Prisma.CompanyWhereInput = {
  showcaseEnabled: true,
  status: 'ACTIVE',
  deletedAt: null,
  slug: { not: null },
};

/**
 * Leitura pública da vitrine. Toda consulta roda com `app.public_read` (RLS só
 * libera o que está publicado) e devolve apenas campos públicos.
 */
@Injectable()
export class PublicShowcaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async listVehicles(query: ListPublicVehiclesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;
    const where = this.buildWhere(query);
    const orderBy: Prisma.VehicleOrderByWithRelationInput[] =
      query.sort === 'price_asc'
        ? [{ priceCents: 'asc' }, { createdAt: 'desc' }]
        : query.sort === 'price_desc'
          ? [{ priceCents: 'desc' }, { createdAt: 'desc' }]
          : [{ createdAt: 'desc' }];

    const facetWhere = this.buildWhere({ store: query.store });

    return runWithRlsPublicRead(async () => {
      const [total, rows, makes] = await Promise.all([
        this.prisma.vehicle.count({ where }),
        this.prisma.vehicle.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            company: { select: STORE_SELECT },
            photos: { orderBy: { sortOrder: 'asc' }, take: 1 },
          },
        }),
        this.prisma.vehicle.groupBy({
          by: ['make'],
          where: facetWhere,
          _count: { _all: true },
          orderBy: { make: 'asc' },
        }),
      ]);

      return {
        data: rows.map((v) => this.toCard(v)),
        meta: {
          page,
          limit,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / limit),
          makes: makes.map((m) => ({ make: m.make, count: m._count._all })),
        },
      };
    });
  }

  async getVehicle(slug: string): Promise<PublicVehicleDetail> {
    const v = await runWithRlsPublicRead(() =>
      this.prisma.vehicle.findFirst({
        where: {
          slug,
          deletedAt: null,
          status: { not: VehicleStatus.ARCHIVED },
          company: PUBLISHED_COMPANY,
        },
        include: {
          company: { select: STORE_SELECT },
          photos: { orderBy: { sortOrder: 'asc' } },
        },
      }),
    );
    if (!v) throw new NotFoundException('Veículo não encontrado');
    return {
      ...this.toCard(v),
      bodyType: v.bodyType,
      color: v.color,
      description: v.description,
      photos: v.photos.map((p) => ({
        url: this.storage.publicUrl(p.storageKey),
        width: p.width,
        height: p.height,
      })),
      store: this.toStore(v.company),
    };
  }

  async getStore(slug: string) {
    const company = await this.prisma.company.findFirst({
      where: { ...PUBLISHED_COMPANY, slug },
      select: STORE_SELECT,
    });
    if (!company) throw new NotFoundException('Loja não encontrada');
    const vehicleCount = await runWithRlsPublicRead(() =>
      this.prisma.vehicle.count({
        where: {
          companyId: company.id,
          deletedAt: null,
          status: { in: [...SHOWCASE_LISTED_STATUSES] },
        },
      }),
    );
    return { ...this.toStore(company), vehicleCount };
  }

  /** Para o formulário e o analytics: carro publicado + loja dona. */
  async resolveVehicle(slug: string) {
    return runWithRlsPublicRead(() =>
      this.prisma.vehicle.findFirst({
        where: {
          slug,
          deletedAt: null,
          status: { not: VehicleStatus.ARCHIVED },
          company: PUBLISHED_COMPANY,
        },
        select: {
          id: true,
          companyId: true,
          slug: true,
          showcaseCode: true,
          make: true,
          model: true,
          yearModel: true,
          status: true,
          company: { select: { name: true, publicWhatsapp: true } },
        },
      }),
    );
  }

  async resolveStoreId(slug: string): Promise<string | null> {
    const c = await this.prisma.company.findFirst({
      where: { ...PUBLISHED_COMPANY, slug },
      select: { id: true },
    });
    return c?.id ?? null;
  }

  private buildWhere(
    query: Partial<ListPublicVehiclesQueryDto>,
  ): Prisma.VehicleWhereInput {
    const and: Prisma.VehicleWhereInput[] = [];
    if (query.q) {
      for (const word of query.q.split(/\s+/).filter(Boolean).slice(0, 5)) {
        and.push({
          OR: [
            { make: { contains: word, mode: 'insensitive' } },
            { model: { contains: word, mode: 'insensitive' } },
            { version: { contains: word, mode: 'insensitive' } },
          ],
        });
      }
    }
    return {
      deletedAt: null,
      status: { in: [...SHOWCASE_LISTED_STATUSES] },
      company: {
        ...PUBLISHED_COMPANY,
        ...(query.store ? { slug: query.store } : {}),
      },
      ...(query.make
        ? { make: { equals: query.make, mode: 'insensitive' } }
        : {}),
      ...(query.maxPrice ? { priceCents: { lte: query.maxPrice * 100 } } : {}),
      ...(query.minYear ? { yearModel: { gte: query.minYear } } : {}),
      ...(query.transmission ? { transmission: query.transmission } : {}),
      ...(query.fuel ? { fuel: query.fuel } : {}),
      ...(and.length ? { AND: and } : {}),
    };
  }

  private toStore(c: {
    slug: string | null;
    name: string;
    city: string | null;
    publicAddress: string | null;
    publicWhatsapp: string | null;
  }): PublicStore {
    return {
      slug: c.slug ?? '',
      name: c.name,
      city: c.city,
      address: c.publicAddress,
      whatsapp: c.publicWhatsapp ? toLeadPhone(c.publicWhatsapp) : null,
    };
  }

  private toCard(
    v: Prisma.VehicleGetPayload<{
      include: {
        company: { select: typeof STORE_SELECT };
        photos: true;
      };
    }>,
  ): PublicVehicleCard {
    const cover = v.photos[0];
    return {
      slug: v.slug,
      code: v.showcaseCode,
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
      coverUrl: cover ? this.storage.publicUrl(cover.storageKey) : null,
      store: {
        slug: v.company.slug ?? '',
        name: v.company.name,
        city: v.company.city,
      },
    };
  }
}
