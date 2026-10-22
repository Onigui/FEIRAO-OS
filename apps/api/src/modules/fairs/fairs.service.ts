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
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { runWithRlsPublicRead } from '../../prisma/rls-context';
import { AuditService } from '../audit/audit.service';
import type { CompanyActor } from '../inventory/vehicles.service';
import { generateShortCode, slugify } from '../inventory/utils/codes';
import {
  ChangeFairStatusDto,
  CreateFairDto,
  InviteStoresDto,
  UpdateFairDto,
} from './dto/fair.dto';
import {
  FAIR_CREATE,
  FAIR_INVITE,
  FAIR_INVITE_REMOVE,
  FAIR_INVITE_RESPONSE,
  FAIR_MAX_DURATION_DAYS,
  FAIR_STATUS_CHANGE,
  FAIR_UPDATE,
} from './fairs.constants';
import {
  canAdvanceFair,
  isFairFrozen,
  nextFairStatus,
} from './utils/fair-status';

type RequestMeta = { ip?: string; userAgent?: string };

export type FairSummary = {
  id: string;
  name: string;
  slug: string;
  startsAt: Date;
  endsAt: Date;
  venue: string;
  address: string | null;
  description: string | null;
  status: FairStatus;
  nextStatus: FairStatus | null;
  organizer: { id: string; name: string };
  isOrganizer: boolean;
  myParticipation: {
    status: FairParticipantStatus;
    respondedAt: Date | null;
  } | null;
  counts: { acceptedStores: number; vehicles: number; myVehicles: number };
};

const UNIQUE_RETRIES = 5;

/**
 * Feirões no painel: organizador cria, convida e avança o status; lojas convidadas
 * aceitam ou recusam. Os carros do feirão ficam em FairVehiclesService.
 */
@Injectable()
export class FairsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: CompanyActor) {
    const fairs = await this.prisma.fair.findMany({
      where: {
        deletedAt: null,
        OR: [
          { companyId: actor.cid },
          { participants: { some: { companyId: actor.cid } } },
        ],
      },
      orderBy: { startsAt: 'desc' },
      take: 100,
      include: this.summaryInclude(actor.cid),
    });
    const items = await Promise.all(fairs.map((f) => this.toSummary(actor, f)));
    const now = Date.now();
    const upcoming = items
      .filter(
        (f) =>
          f.endsAt.getTime() >= now &&
          f.status !== FairStatus.ENDED &&
          (f.isOrganizer ||
            f.myParticipation?.status === FairParticipantStatus.ACCEPTED),
      )
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    return {
      organizing: items.filter((f) => f.isOrganizer),
      participating: items.filter(
        (f) =>
          !f.isOrganizer &&
          f.myParticipation?.status === FairParticipantStatus.ACCEPTED,
      ),
      invites: items.filter(
        (f) =>
          !f.isOrganizer &&
          f.myParticipation?.status === FairParticipantStatus.INVITED,
      ),
      declined: items.filter(
        (f) =>
          !f.isOrganizer &&
          f.myParticipation?.status === FairParticipantStatus.DECLINED,
      ),
      next: upcoming[0] ?? null,
    };
  }

  async detail(actor: CompanyActor, id: string) {
    const fair = await this.findVisible(actor, id);
    const summary = await this.toSummary(actor, fair);
    const isOrganizer = fair.companyId === actor.cid;

    const participants = isOrganizer
      ? await this.prisma.fairParticipant.findMany({
          where: { fairId: id },
          orderBy: { invitedAt: 'asc' },
          include: {
            company: {
              select: {
                id: true,
                name: true,
                slug: true,
                city: true,
                showcaseEnabled: true,
              },
            },
          },
        })
      : [];
    const perStore = isOrganizer
      ? await this.prisma.fairVehicle.groupBy({
          by: ['companyId'],
          where: { fairId: id },
          _count: { _all: true },
        })
      : [];
    const countOf = (companyId: string) =>
      perStore.find((p) => p.companyId === companyId)?._count._all ?? 0;

    return {
      ...summary,
      participants: participants.map((p) => ({
        companyId: p.companyId,
        name: p.company.name,
        slug: p.company.slug,
        city: p.company.city,
        showcaseEnabled: p.company.showcaseEnabled,
        status: p.status,
        invitedAt: p.invitedAt,
        respondedAt: p.respondedAt,
        vehicles: countOf(p.companyId),
        isOrganizer: p.companyId === fair.companyId,
      })),
    };
  }

  async create(actor: CompanyActor, dto: CreateFairDto, meta?: RequestMeta) {
    this.assertDates(dto.startsAt, dto.endsAt);
    for (let attempt = 1; ; attempt += 1) {
      try {
        const fair = await this.prisma.$transaction(async (tx) => {
          const created = await tx.fair.create({
            data: {
              companyId: actor.cid,
              name: dto.name,
              slug: this.buildSlug(dto.name, dto.startsAt),
              startsAt: dto.startsAt,
              endsAt: dto.endsAt,
              venue: dto.venue,
              address: dto.address ?? null,
              description: dto.description ?? null,
            },
          });
          // O organizador também expõe carros: entra como participante aceito.
          await tx.fairParticipant.create({
            data: {
              fairId: created.id,
              companyId: actor.cid,
              organizerCompanyId: actor.cid,
              status: FairParticipantStatus.ACCEPTED,
              respondedAt: new Date(),
            },
          });
          await this.audit.write(tx, {
            companyId: actor.cid,
            actorUserId: actor.sub,
            action: FAIR_CREATE,
            targetType: 'FAIR',
            targetId: created.id,
            before: null,
            after: {
              name: created.name,
              slug: created.slug,
              startsAt: created.startsAt,
              endsAt: created.endsAt,
            },
            ip: meta?.ip,
            userAgent: meta?.userAgent,
          });
          return created;
        });
        return this.detail(actor, fair.id);
      } catch (error) {
        if (this.isUnique(error) && attempt < UNIQUE_RETRIES) continue;
        throw error;
      }
    }
  }

  async update(
    actor: CompanyActor,
    id: string,
    dto: UpdateFairDto,
    meta?: RequestMeta,
  ) {
    const fair = await this.findOrganized(actor, id);
    if (isFairFrozen(fair.status)) {
      throw new ConflictException({
        code: 'FAIR_ENDED',
        message: 'Feirão encerrado não muda mais.',
      });
    }
    const startsAt = dto.startsAt ?? fair.startsAt;
    const endsAt = dto.endsAt ?? fair.endsAt;
    this.assertDates(startsAt, endsAt);
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.fair.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.venue !== undefined ? { venue: dto.venue } : {}),
          ...(dto.address !== undefined ? { address: dto.address } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          startsAt,
          endsAt,
        },
      });
      await this.audit.write(tx, {
        companyId: actor.cid,
        actorUserId: actor.sub,
        action: FAIR_UPDATE,
        targetType: 'FAIR',
        targetId: id,
        before: this.snapshot(fair),
        after: this.snapshot(updated),
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });
    });
    return this.detail(actor, id);
  }

  async changeStatus(
    actor: CompanyActor,
    id: string,
    dto: ChangeFairStatusDto,
    meta?: RequestMeta,
  ) {
    const fair = await this.findOrganized(actor, id);
    if (!canAdvanceFair(fair.status, dto.toStatus)) {
      throw new ConflictException({
        code: 'FAIR_STATUS_INVALID',
        message:
          'O status do feirão só avança: rascunho → publicado → ao vivo → encerrado.',
      });
    }
    if (dto.toStatus === FairStatus.PUBLISHED) {
      const organizer = await this.prisma.company.findFirst({
        where: { id: actor.cid },
        select: { showcaseEnabled: true, slug: true },
      });
      if (!organizer?.showcaseEnabled || !organizer.slug) {
        throw new BadRequestException({
          code: 'SHOWCASE_REQUIRED',
          message: 'Ative a vitrine da sua loja antes de publicar o feirão.',
        });
      }
    }

    const res = await this.prisma.$transaction(async (tx) => {
      const r = await tx.fair.updateMany({
        where: { id, status: fair.status },
        data: { status: dto.toStatus },
      });
      if (r.count === 0) return r;
      await this.audit.write(tx, {
        companyId: actor.cid,
        actorUserId: actor.sub,
        action: FAIR_STATUS_CHANGE,
        targetType: 'FAIR',
        targetId: id,
        before: { status: fair.status },
        after: { status: dto.toStatus },
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });
      return r;
    });
    if (res.count === 0) {
      throw new ConflictException({
        code: 'FAIR_STATUS_CHANGED',
        message: 'Outra pessoa mudou o status agora. Atualize a página.',
      });
    }
    return this.detail(actor, id);
  }

  /** Lojas que podem ser convidadas (dados públicos: nome, endereço da vitrine, cidade). */
  async searchStores(actor: CompanyActor, q?: string) {
    const rows = await this.prisma.company.findMany({
      where: {
        id: { not: actor.cid },
        deletedAt: null,
        status: 'ACTIVE',
        slug: { not: null },
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { slug: { contains: q.toLowerCase() } },
                { city: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      take: 30,
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        showcaseEnabled: true,
      },
    });
    return rows;
  }

  async invite(
    actor: CompanyActor,
    id: string,
    dto: InviteStoresDto,
    meta?: RequestMeta,
  ) {
    const fair = await this.findOrganized(actor, id);
    if (isFairFrozen(fair.status)) {
      throw new ConflictException({
        code: 'FAIR_ENDED',
        message: 'Feirão encerrado não recebe convites.',
      });
    }
    const ids = [...new Set(dto.companyIds)].filter((c) => c !== actor.cid);
    const companies = await this.prisma.company.findMany({
      where: { id: { in: ids }, deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    });
    if (companies.length !== ids.length) {
      throw new BadRequestException('Loja não encontrada.');
    }
    let invited = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const c of companies) {
        const existing = await tx.fairParticipant.findFirst({
          where: { fairId: id, companyId: c.id },
        });
        if (existing) {
          // Quem recusou pode ser convidado de novo.
          if (existing.status === FairParticipantStatus.DECLINED) {
            await tx.fairParticipant.update({
              where: { id: existing.id },
              data: {
                status: FairParticipantStatus.INVITED,
                invitedAt: new Date(),
                respondedAt: null,
              },
            });
            invited += 1;
          }
          continue;
        }
        await tx.fairParticipant.create({
          data: { fairId: id, companyId: c.id, organizerCompanyId: actor.cid },
        });
        invited += 1;
      }
      await this.audit.write(tx, {
        companyId: actor.cid,
        actorUserId: actor.sub,
        action: FAIR_INVITE,
        targetType: 'FAIR',
        targetId: id,
        before: null,
        after: { companyIds: ids, invited },
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });
    });
    return { invited, fair: await this.detail(actor, id) };
  }

  /** Organizador tira um convite ainda sem carros (convidada ou que recusou). */
  async removeInvite(
    actor: CompanyActor,
    id: string,
    companyId: string,
    meta?: RequestMeta,
  ) {
    const fair = await this.findOrganized(actor, id);
    if (companyId === actor.cid) {
      throw new BadRequestException('O organizador não sai do próprio feirão.');
    }
    if (isFairFrozen(fair.status)) {
      throw new ConflictException({
        code: 'FAIR_ENDED',
        message: 'Feirão encerrado não muda mais.',
      });
    }
    const p = await this.prisma.fairParticipant.findFirst({
      where: { fairId: id, companyId },
    });
    if (!p) throw new NotFoundException('Convite não encontrado.');
    if (p.status === FairParticipantStatus.ACCEPTED) {
      throw new ConflictException({
        code: 'PARTICIPANT_ACCEPTED',
        message: 'A loja já aceitou. Ela mesma pode sair do feirão.',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.fairParticipant.delete({ where: { id: p.id } });
      await this.audit.write(tx, {
        companyId: actor.cid,
        actorUserId: actor.sub,
        action: FAIR_INVITE_REMOVE,
        targetType: 'FAIR',
        targetId: id,
        before: { companyId, status: p.status },
        after: null,
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });
    });
    return this.detail(actor, id);
  }

  /**
   * Loja convidada aceita (precisa da vitrine ativa: o público vê os carros dela)
   * ou recusa/sai (os carros dela saem do feirão).
   */
  async respond(
    actor: CompanyActor,
    id: string,
    accept: boolean,
    meta?: RequestMeta,
  ) {
    const fair = await this.findVisible(actor, id);
    if (fair.companyId === actor.cid) {
      throw new BadRequestException(
        'O organizador já participa do próprio feirão.',
      );
    }
    if (isFairFrozen(fair.status)) {
      throw new ConflictException({
        code: 'FAIR_ENDED',
        message: 'Feirão encerrado não muda mais.',
      });
    }
    const p = await this.prisma.fairParticipant.findFirst({
      where: { fairId: id, companyId: actor.cid },
    });
    if (!p) throw new NotFoundException('Convite não encontrado.');

    if (accept) {
      const me = await this.prisma.company.findFirst({
        where: { id: actor.cid },
        select: { showcaseEnabled: true },
      });
      if (!me?.showcaseEnabled) {
        throw new BadRequestException({
          code: 'SHOWCASE_REQUIRED',
          message:
            'Ative a vitrine da loja antes de aceitar: o público vê os carros por ela.',
        });
      }
    }

    const status = accept
      ? FairParticipantStatus.ACCEPTED
      : FairParticipantStatus.DECLINED;
    await this.prisma.$transaction(async (tx) => {
      if (!accept) {
        await tx.fairVehicle.deleteMany({
          where: { fairId: id, companyId: actor.cid },
        });
      }
      await tx.fairParticipant.update({
        where: { id: p.id },
        data: { status, respondedAt: new Date() },
      });
      await this.audit.write(tx, {
        companyId: actor.cid,
        actorUserId: actor.sub,
        action: FAIR_INVITE_RESPONSE,
        targetType: 'FAIR',
        targetId: id,
        before: { status: p.status },
        after: { status },
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });
    });
    return this.detail(actor, id);
  }

  // ---- auxiliares compartilhados com os outros serviços do módulo ----

  /** Feirão que a loja enxerga: organiza ou foi convidada. */
  async findVisible(actor: CompanyActor, id: string): Promise<Fair> {
    const fair = await this.prisma.fair.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [
          { companyId: actor.cid },
          { participants: { some: { companyId: actor.cid } } },
        ],
      },
    });
    if (!fair) throw new NotFoundException('Feirão não encontrado.');
    return fair;
  }

  async findOrganized(actor: CompanyActor, id: string): Promise<Fair> {
    const fair = await this.findVisible(actor, id);
    if (fair.companyId !== actor.cid) {
      throw new ForbiddenException('Só a loja organizadora pode fazer isso.');
    }
    return fair;
  }

  private summaryInclude(cid: string) {
    return {
      organizer: { select: { id: true, name: true } },
      participants: { where: { companyId: cid } },
    } satisfies Prisma.FairInclude;
  }

  private async toSummary(
    actor: CompanyActor,
    fair: Fair & {
      organizer?: { id: string; name: string };
      participants?: {
        status: FairParticipantStatus;
        respondedAt: Date | null;
        companyId: string;
      }[];
    },
  ): Promise<FairSummary> {
    const isOrganizer = fair.companyId === actor.cid;
    const organizer =
      fair.organizer ??
      (await this.prisma.company.findFirstOrThrow({
        where: { id: fair.companyId },
        select: { id: true, name: true },
      }));
    const mine =
      fair.participants?.find((p) => p.companyId === actor.cid) ??
      (await this.prisma.fairParticipant.findFirst({
        where: { fairId: fair.id, companyId: actor.cid },
      }));

    // Totais do feirão: o organizador lê tudo; a convidada vê o mesmo que o público.
    const countAll = (where: Prisma.FairVehicleWhereInput) =>
      isOrganizer || fair.status === FairStatus.DRAFT
        ? this.prisma.fairVehicle.count({ where })
        : runWithRlsPublicRead(() => this.prisma.fairVehicle.count({ where }));
    const countAccepted = (where: Prisma.FairParticipantWhereInput) =>
      isOrganizer || fair.status === FairStatus.DRAFT
        ? this.prisma.fairParticipant.count({ where })
        : runWithRlsPublicRead(() =>
            this.prisma.fairParticipant.count({ where }),
          );

    const [vehicles, myVehicles, acceptedStores] = await Promise.all([
      countAll({ fairId: fair.id }),
      this.prisma.fairVehicle.count({
        where: { fairId: fair.id, companyId: actor.cid },
      }),
      countAccepted({
        fairId: fair.id,
        status: FairParticipantStatus.ACCEPTED,
      }),
    ]);

    return {
      id: fair.id,
      name: fair.name,
      slug: fair.slug,
      startsAt: fair.startsAt,
      endsAt: fair.endsAt,
      venue: fair.venue,
      address: fair.address,
      description: fair.description,
      status: fair.status,
      nextStatus: isOrganizer ? nextFairStatus(fair.status) : null,
      organizer,
      isOrganizer,
      myParticipation: mine
        ? { status: mine.status, respondedAt: mine.respondedAt }
        : null,
      counts: { acceptedStores, vehicles, myVehicles },
    };
  }

  private assertDates(startsAt: Date, endsAt: Date) {
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException('O fim precisa ser depois do início.');
    }
    const maxMs = FAIR_MAX_DURATION_DAYS * 24 * 60 * 60 * 1000;
    if (endsAt.getTime() - startsAt.getTime() > maxMs) {
      throw new BadRequestException(
        `O feirão pode durar até ${FAIR_MAX_DURATION_DAYS} dias.`,
      );
    }
  }

  private buildSlug(name: string, startsAt: Date): string {
    const day = startsAt.toISOString().slice(0, 10);
    return `${slugify(name) || 'feirao'}-${day}-${generateShortCode(4).toLowerCase()}`.slice(
      0,
      160,
    );
  }

  private snapshot(f: Fair) {
    return {
      name: f.name,
      startsAt: f.startsAt,
      endsAt: f.endsAt,
      venue: f.venue,
      address: f.address,
      status: f.status,
    };
  }

  private isUnique(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
