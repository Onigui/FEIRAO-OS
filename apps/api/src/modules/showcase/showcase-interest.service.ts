import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  LeadStatus,
  Prisma,
  VehicleInterestIntent,
  VehicleStatus,
} from '@prisma/client';
import { runWithTenant } from '../../core/tenancy/tenant-als';
import { PrismaService } from '../../prisma/prisma.service';
import { runWithoutRlsPublicRead } from '../../prisma/rls-context';
import { AuditService } from '../audit/audit.service';
import { CreateInterestDto } from './dto/create-interest.dto';
import { PublicShowcaseService } from './public-showcase.service';
import {
  SHOWCASE_CONSENT_TEXT_VERSION,
  SHOWCASE_INTEREST_CREATED,
  SHOWCASE_INTEREST_DEDUPE_MS,
  SHOWCASE_LEAD_SOURCE,
} from './showcase.constants';
import { leadPhoneCandidates, toLeadPhone, whatsappLink } from './utils/phone';

export type InterestResult = {
  ok: true;
  storeName: string;
  /** Conversa no WhatsApp da loja com a mensagem pronta (se a loja informou o número). */
  whatsappUrl: string | null;
};

type RequestMeta = { ip?: string; userAgent?: string };

/**
 * Formulário de interesse → Lead da loja dona do carro.
 * Reaproveita o lead pelo telefone, sempre grava o interesse com as autorizações
 * e não duplica o mesmo carro para a mesma pessoa em 24 horas.
 */
@Injectable()
export class ShowcaseInterestService {
  private readonly logger = new Logger(ShowcaseInterestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly showcase: PublicShowcaseService,
  ) {}

  async create(
    dto: CreateInterestDto,
    meta?: RequestMeta,
  ): Promise<InterestResult> {
    const vehicle = await this.showcase.resolveVehicle(dto.vehicleSlug);
    if (!vehicle) throw new NotFoundException('Veículo não encontrado');

    const storeName = vehicle.company.name;
    const whatsappUrl = vehicle.company.publicWhatsapp
      ? whatsappLink(
          vehicle.company.publicWhatsapp,
          `Olá! Tenho interesse no ${vehicle.make} ${vehicle.model} ${vehicle.yearModel} (anúncio ${vehicle.showcaseCode}).`,
        )
      : null;

    // Campo-armadilha preenchido: responde como sucesso e não grava nada.
    if (dto.website && dto.website.trim() !== '') {
      this.logger.warn(`showcase interest honeypot vehicle=${vehicle.id}`);
      return { ok: true, storeName, whatsappUrl };
    }

    if (vehicle.status === VehicleStatus.SOLD) {
      throw new ConflictException({
        code: 'VEHICLE_SOLD',
        message: 'Este carro já foi vendido.',
      });
    }

    const phone = toLeadPhone(dto.phone);
    if (!phone) {
      throw new BadRequestException({
        code: 'INVALID_PHONE',
        message: 'Informe um WhatsApp com DDD.',
      });
    }

    const now = new Date();
    const companyId = vehicle.companyId;
    const fair = dto.fairSlug
      ? await this.showcase.resolveFairForVehicle(dto.fairSlug, vehicle.id)
      : null;
    const source = dto.source ?? (fair ? 'FAIR_PAGE' : 'VEHICLE_PAGE');

    const save = () =>
      runWithoutRlsPublicRead(() =>
        runWithTenant(companyId, () =>
          this.prisma.$transaction(async (tx) => {
            const { lead, created } = await this.resolveLead(tx, companyId, {
              name: dto.name,
              phone,
            });

            const recent = await tx.leadVehicleInterest.findFirst({
              where: {
                companyId,
                leadId: lead.id,
                vehicleId: vehicle.id,
                createdAt: {
                  gt: new Date(now.getTime() - SHOWCASE_INTEREST_DEDUPE_MS),
                },
              },
              orderBy: { createdAt: 'desc' },
            });

            if (recent) {
              // Repetição: não duplica; só registra a autorização de ofertas se veio agora.
              if (dto.consentMarketing && !recent.consentMarketingAt) {
                await tx.leadVehicleInterest.update({
                  where: { id: recent.id },
                  data: { consentMarketingAt: now },
                });
              }
              return;
            }

            const interest = await tx.leadVehicleInterest.create({
              data: {
                companyId,
                leadId: lead.id,
                vehicleId: vehicle.id,
                intent: VehicleInterestIntent.INTEREST,
                source,
                fairId: fair?.id ?? null,
                fairOrganizerCompanyId: fair?.companyId ?? null,
                consentContactAt: now,
                consentMarketingAt: dto.consentMarketing ? now : null,
                consentTextVersion: SHOWCASE_CONSENT_TEXT_VERSION,
              },
            });

            await tx.lead.update({
              where: { id: lead.id },
              data: { lastContactAt: now },
            });

            await this.audit.write(tx, {
              companyId,
              actorUserId: null,
              action: SHOWCASE_INTEREST_CREATED,
              targetType: 'LEAD',
              targetId: lead.id,
              before: null,
              after: {
                leadId: lead.id,
                interestId: interest.id,
                vehicleId: vehicle.id,
                source: interest.source,
                fairId: interest.fairId,
                leadCreated: created,
                marketingConsent: Boolean(dto.consentMarketing),
              },
              ip: meta?.ip,
              userAgent: meta?.userAgent,
            });
          }),
        ),
      );

    try {
      await save();
    } catch (error) {
      // Duas mensagens ao mesmo tempo do mesmo telefone: a segunda reaproveita o lead.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        await save();
      } else {
        throw error;
      }
    }

    return { ok: true, storeName, whatsappUrl };
  }

  private async resolveLead(
    tx: Prisma.TransactionClient,
    companyId: string,
    input: { name: string; phone: string },
  ) {
    const existing = await tx.lead.findFirst({
      where: {
        companyId,
        phone: { in: leadPhoneCandidates(input.phone) },
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) {
      // Lead criado pelo WhatsApp tem o telefone como nome: troca pelo nome informado.
      if (!existing.name || existing.name === existing.phone) {
        const updated = await tx.lead.update({
          where: { id: existing.id },
          data: { name: input.name },
        });
        return { lead: updated, created: false };
      }
      return { lead: existing, created: false };
    }

    const lead = await tx.lead.create({
      data: {
        companyId,
        name: input.name,
        phone: input.phone,
        source: SHOWCASE_LEAD_SOURCE,
        status: LeadStatus.NEW,
        ownerId: null,
        score: 0,
      },
    });
    await tx.leadStatusTransition.create({
      data: {
        companyId,
        leadId: lead.id,
        fromStatus: null,
        toStatus: lead.status,
        changedByUserId: null,
      },
    });
    await this.audit.write(tx, {
      companyId,
      actorUserId: null,
      action: 'LEAD_AUTO_CREATED',
      targetType: 'LEAD',
      targetId: lead.id,
      before: null,
      after: {
        id: lead.id,
        phone: lead.phone,
        status: lead.status,
        source: SHOWCASE_LEAD_SOURCE,
      },
    });
    return { lead, created: true };
  }
}
