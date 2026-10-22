import { Injectable, Logger } from '@nestjs/common';
import { LeadStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { runWithRlsBypassAsync } from '../../prisma/rls-context';
import { AuditService } from '../audit/audit.service';
import { SHOWCASE_LEAD_SOURCE } from './showcase.constants';

const BATCH = 200;
/** Lead com algum destes status teve andamento e não é anonimizado. */
const PROGRESS_STATUSES: LeadStatus[] = [
  LeadStatus.RESPONDED,
  LeadStatus.QUALIFIED,
  LeadStatus.CONVERTED,
];

export function retentionCutoff(now: Date, months: number): Date {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

/**
 * LGPD — pedido de contato da vitrine sem andamento por N meses (padrão 12) é anonimizado.
 * - O interesse ganha `anonymized_at` (os números do feirão continuam contando).
 * - Se a pessoa só falou com a loja pela vitrine (lead SHOWCASE, sem conversa, nota ou
 *   atividade), nome e telefone são apagados e o lead sai da lista.
 * - Se a loja tem outro histórico com a pessoa (WhatsApp, por exemplo), o lead fica:
 *   esse relacionamento não nasceu da vitrine.
 */
@Injectable()
export class ShowcaseRetentionService {
  private readonly logger = new Logger(ShowcaseRetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async run(
    now = new Date(),
    months = 12,
  ): Promise<{ interests: number; leads: number }> {
    const cutoff = retentionCutoff(now, months);
    return runWithRlsBypassAsync(async () => {
      const stale = await this.prisma.leadVehicleInterest.findMany({
        where: {
          anonymizedAt: null,
          createdAt: { lt: cutoff },
          lead: {
            status: { notIn: PROGRESS_STATUSES },
            OR: [{ lastContactAt: null }, { lastContactAt: { lt: cutoff } }],
            AND: [
              {
                OR: [
                  { lastInboundAt: null },
                  { lastInboundAt: { lt: cutoff } },
                ],
              },
            ],
          },
        },
        select: { id: true, leadId: true, companyId: true },
        take: BATCH,
      });
      if (stale.length === 0) return { interests: 0, leads: 0 };

      // Interesse recente do mesmo lead = ainda tem andamento: não mexe naquele lead.
      const leadIds = [...new Set(stale.map((s) => s.leadId))];
      const recent = await this.prisma.leadVehicleInterest.findMany({
        where: { leadId: { in: leadIds }, createdAt: { gte: cutoff } },
        select: { leadId: true },
      });
      const active = new Set(recent.map((r) => r.leadId));
      const targets = stale.filter((s) => !active.has(s.leadId));

      let leads = 0;
      for (const leadId of new Set(targets.map((t) => t.leadId))) {
        const rows = targets.filter((t) => t.leadId === leadId);
        const companyId = rows[0].companyId;
        await this.prisma.$transaction(async (tx) => {
          await tx.leadVehicleInterest.updateMany({
            where: { id: { in: rows.map((r) => r.id) }, anonymizedAt: null },
            data: { anonymizedAt: now },
          });

          const lead = await tx.lead.findFirst({
            where: { id: leadId, deletedAt: null },
            select: {
              id: true,
              source: true,
              _count: {
                select: { conversations: true, notes: true, activities: true },
              },
            },
          });
          const onlyShowcase =
            lead &&
            lead.source === SHOWCASE_LEAD_SOURCE &&
            lead._count.conversations === 0 &&
            lead._count.notes === 0 &&
            lead._count.activities === 0;
          if (onlyShowcase) {
            await tx.lead.update({
              where: { id: leadId },
              data: {
                name: 'Contato anonimizado',
                phone: `anon-${randomUUID().slice(0, 18)}`,
                email: null,
                metadata: Prisma.DbNull,
                deletedAt: now,
              },
            });
            leads += 1;
          }
          await this.audit.write(tx, {
            companyId,
            actorUserId: null,
            action: 'SHOWCASE_RETENTION_ANONYMIZE',
            targetType: 'LEAD',
            targetId: leadId,
            before: null,
            after: {
              interests: rows.length,
              leadAnonymized: Boolean(onlyShowcase),
              months,
            },
          });
        });
      }
      if (targets.length) {
        this.logger.log(
          `retention anonymized interests=${targets.length} leads=${leads}`,
        );
      }
      return { interests: targets.length, leads };
    });
  }
}
