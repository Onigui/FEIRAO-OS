import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { blockedLeadIdsFromInterests } from './utils/automation-block';

/**
 * Bloqueio das automações para leads da vitrine sem autorização de ofertas.
 * Usado pela recuperação por IA, first-touch, campanhas, execução de follow-ups
 * e pela trava de envio proativo (OutboundProtectionService).
 * A resposta automática da IA a quem escreveu NÃO passa por aqui (decisão da etapa 3).
 */
@Injectable()
export class ShowcaseConsentService {
  constructor(private readonly prisma: PrismaService) {}

  async isBlockedForAutomation(
    companyId: string,
    leadId: string,
  ): Promise<boolean> {
    const blocked = await this.blockedLeadIds(companyId, [leadId]);
    return blocked.has(leadId);
  }

  async blockedLeadIds(
    companyId: string,
    leadIds: string[],
  ): Promise<Set<string>> {
    const ids = [...new Set(leadIds)];
    if (ids.length === 0) return new Set();
    const rows = await this.prisma.leadVehicleInterest.findMany({
      where: { companyId, leadId: { in: ids } },
      select: { leadId: true, consentMarketingAt: true },
    });
    return blockedLeadIdsFromInterests(rows);
  }
}
