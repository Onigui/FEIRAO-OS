import { Injectable } from '@nestjs/common';
import { ShowcaseAnalyticsType, VehicleStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type LeadInterestView = {
  id: string;
  source: string;
  createdAt: Date;
  marketingConsent: boolean;
  automationBlocked: boolean;
  vehicle: {
    id: string;
    make: string;
    model: string;
    yearModel: number;
    priceCents: number;
    status: VehicleStatus;
    code: string;
    coverUrl: string | null;
  } | null;
};

/** Números da vitrine e interesses por lead para o painel da loja. */
@Injectable()
export class ShowcasePanelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async stats(companyId: string, now = new Date()) {
    const since = new Date(now.getTime() - WEEK_MS);
    const [availableVehicles, contactsWeek, whatsappClicksWeek, pageViewsWeek] =
      await Promise.all([
        this.prisma.vehicle.count({
          where: {
            companyId,
            deletedAt: null,
            status: VehicleStatus.AVAILABLE,
          },
        }),
        this.prisma.leadVehicleInterest.count({
          where: { companyId, createdAt: { gte: since } },
        }),
        this.prisma.showcaseAnalyticsEvent.count({
          where: {
            companyId,
            type: ShowcaseAnalyticsType.WHATSAPP_CLICK,
            occurredAt: { gte: since },
          },
        }),
        this.prisma.showcaseAnalyticsEvent.count({
          where: {
            companyId,
            type: ShowcaseAnalyticsType.PAGE_VIEW,
            occurredAt: { gte: since },
          },
        }),
      ]);
    return {
      availableVehicles,
      contactsWeek,
      whatsappClicksWeek,
      pageViewsWeek,
    };
  }

  /** Interesses por lead (mais recente primeiro), para o card e o detalhe do lead. */
  async leadInterests(
    companyId: string,
    leadIds: string[],
  ): Promise<Record<string, LeadInterestView[]>> {
    const rows = await this.prisma.leadVehicleInterest.findMany({
      where: { companyId, leadId: { in: leadIds } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        vehicle: {
          include: { photos: { orderBy: { sortOrder: 'asc' }, take: 1 } },
        },
      },
    });

    const consented = new Set(
      rows.filter((r) => r.consentMarketingAt).map((r) => r.leadId),
    );
    const out: Record<string, LeadInterestView[]> = {};
    for (const r of rows) {
      const v = r.vehicle;
      (out[r.leadId] ??= []).push({
        id: r.id,
        source: r.source,
        createdAt: r.createdAt,
        marketingConsent: Boolean(r.consentMarketingAt),
        automationBlocked: !consented.has(r.leadId),
        vehicle: v
          ? {
              id: v.id,
              make: v.make,
              model: v.model,
              yearModel: v.yearModel,
              priceCents: v.priceCents,
              status: v.status,
              code: v.showcaseCode,
              coverUrl: v.photos[0]
                ? this.storage.publicUrl(v.photos[0].storageKey)
                : null,
            }
          : null,
      });
    }
    return out;
  }
}
