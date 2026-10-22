import { Injectable } from '@nestjs/common';
import {
  FairParticipantStatus,
  ShowcaseAnalyticsType,
  VehicleStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CompanyActor } from '../inventory/vehicles.service';
import { FairsService } from './fairs.service';
import { buildFairReport, fairReportCsv } from './utils/fair-report';
import { soldDuringFair } from './utils/fair-status';

/**
 * Relatório do feirão. O organizador vê todas as lojas; a convidada, só a própria.
 * Contatos são contados pelas linhas de interesse (sem nome nem telefone).
 */
@Injectable()
export class FairReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fairs: FairsService,
  ) {}

  async report(actor: CompanyActor, fairId: string) {
    const fair = await this.fairs.findVisible(actor, fairId);
    const isOrganizer = fair.companyId === actor.cid;
    const scope = isOrganizer ? {} : { companyId: actor.cid };

    const [participants, fairVehicles, interests, events, pageViews] =
      await Promise.all([
        this.prisma.fairParticipant.findMany({
          where: { fairId, status: FairParticipantStatus.ACCEPTED, ...scope },
          include: { company: { select: { id: true, name: true } } },
        }),
        this.prisma.fairVehicle.findMany({
          where: { fairId, ...scope },
          select: {
            companyId: true,
            priceCentsAtFair: true,
            vehicle: { select: { status: true, soldAt: true } },
          },
        }),
        this.prisma.leadVehicleInterest.groupBy({
          by: ['companyId'],
          where: { fairId, ...scope },
          _count: { _all: true },
        }),
        this.prisma.showcaseAnalyticsEvent.groupBy({
          by: ['companyId', 'type'],
          where: {
            fairId,
            type: {
              in: [
                ShowcaseAnalyticsType.QR_SCAN,
                ShowcaseAnalyticsType.WHATSAPP_CLICK,
              ],
            },
            ...scope,
          },
          _count: { _all: true },
        }),
        this.prisma.showcaseAnalyticsEvent.count({
          where: { fairId, type: ShowcaseAnalyticsType.PAGE_VIEW },
        }),
      ]);

    const byCompany = (type: ShowcaseAnalyticsType) =>
      Object.fromEntries(
        events
          .filter((e) => e.type === type && e.companyId)
          .map((e) => [e.companyId as string, e._count._all]),
      );

    const report = buildFairReport({
      stores: participants.map((p) => ({
        companyId: p.companyId,
        storeName: p.company.name,
      })),
      vehicles: fairVehicles.map((fv) => ({
        companyId: fv.companyId,
        status: fv.vehicle.status,
        soldDuringFair:
          fv.vehicle.status === VehicleStatus.SOLD &&
          soldDuringFair(fv.vehicle.soldAt, fair),
        priceCentsAtFair: fv.priceCentsAtFair,
      })),
      interestsByCompany: Object.fromEntries(
        interests.map((i) => [i.companyId, i._count._all]),
      ),
      qrByCompany: byCompany(ShowcaseAnalyticsType.QR_SCAN),
      whatsappByCompany: byCompany(ShowcaseAnalyticsType.WHATSAPP_CLICK),
      pageViews,
    });

    return {
      fair: {
        id: fair.id,
        name: fair.name,
        slug: fair.slug,
        status: fair.status,
        startsAt: fair.startsAt,
        endsAt: fair.endsAt,
        venue: fair.venue,
      },
      scope: isOrganizer ? ('ALL_STORES' as const) : ('MY_STORE' as const),
      ...report,
    };
  }

  async csv(actor: CompanyActor, fairId: string) {
    const r = await this.report(actor, fairId);
    return {
      filename: `relatorio-${r.fair.slug}.csv`,
      body: fairReportCsv({ totals: r.totals, stores: r.stores }),
    };
  }
}
