import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Company, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { normalizePhone } from '../leads/utils/normalize-phone';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';
import { UpdateShowcaseSettingsDto } from './dto/update-showcase-settings.dto';

/** Versão do termo de uso da vitrine exibido em /termos. */
export const SHOWCASE_TERMS_VERSION = 'v1-2026-11';

type CompanyActor = AuthenticatedUser & { cid: string; sub: string };

type RequestMeta = {
  ip?: string;
  userAgent?: string;
};

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getSettings(actor: CompanyActor) {
    const company = await this.prisma.company.findFirst({
      where: { id: actor.cid, deletedAt: null },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return this.toSettings(company);
  }

  async updateSettings(
    actor: CompanyActor,
    dto: UpdateCompanySettingsDto,
    meta?: RequestMeta,
  ) {
    const existing = await this.prisma.company.findFirst({
      where: { id: actor.cid, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Company not found');
    }

    const data: Prisma.CompanyUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    if (dto.locale !== undefined) data.locale = dto.locale;
    if (dto.businessHours !== undefined) {
      data.businessHours =
        dto.businessHours === null
          ? Prisma.JsonNull
          : (dto.businessHours as Prisma.InputJsonValue);
    }
    if (dto.logoUrl !== undefined) data.logoUrl = dto.logoUrl;
    if (dto.currency !== undefined) data.currency = dto.currency;

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const company = await tx.company.update({
          where: { id: actor.cid },
          data,
        });
        await this.audit.write(tx, {
          companyId: actor.cid,
          actorUserId: actor.sub,
          action: 'COMPANY_SETTINGS_UPDATE',
          targetType: 'COMPANY',
          targetId: company.id,
          before: this.snapshot(existing),
          after: this.snapshot(company),
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        });
        return company;
      });
      return this.toSettings(updated);
    } catch (error) {
      this.rethrowSlugConflict(error);
      throw error;
    }
  }

  /** Vitrine e Feirões — dados públicos da loja. */
  async getShowcase(actor: CompanyActor) {
    const company = await this.prisma.company.findFirst({
      where: { id: actor.cid, deletedAt: null },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return this.toShowcase(company);
  }

  async updateShowcase(
    actor: CompanyActor,
    dto: UpdateShowcaseSettingsDto,
    meta?: RequestMeta,
  ) {
    const existing = await this.prisma.company.findFirst({
      where: { id: actor.cid, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Company not found');
    }

    const data: Prisma.CompanyUpdateInput = {};
    if (dto.publicWhatsapp !== undefined) {
      data.publicWhatsapp =
        dto.publicWhatsapp === null
          ? null
          : this.normalizeWhatsapp(dto.publicWhatsapp);
    }
    if (dto.publicAddress !== undefined) data.publicAddress = dto.publicAddress;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.acceptTerms === true && !existing.showcaseTermsAcceptedAt) {
      data.showcaseTermsAcceptedAt = new Date();
    }
    if (dto.showcaseEnabled !== undefined)
      data.showcaseEnabled = dto.showcaseEnabled;

    const next = {
      slug: existing.slug,
      publicWhatsapp:
        data.publicWhatsapp !== undefined
          ? (data.publicWhatsapp as string | null)
          : existing.publicWhatsapp,
      city:
        data.city !== undefined ? (data.city as string | null) : existing.city,
      termsAcceptedAt:
        (data.showcaseTermsAcceptedAt as Date | undefined) ??
        existing.showcaseTermsAcceptedAt,
      enabled:
        dto.showcaseEnabled !== undefined
          ? dto.showcaseEnabled
          : existing.showcaseEnabled,
    };
    if (next.enabled) {
      const missing: string[] = [];
      if (!next.slug) missing.push('endereço da vitrine (em Configurações)');
      if (!next.publicWhatsapp) missing.push('WhatsApp público');
      if (!next.city) missing.push('cidade');
      if (!next.termsAcceptedAt) missing.push('aceite do termo de uso');
      if (missing.length > 0) {
        throw new BadRequestException({
          code: 'SHOWCASE_INCOMPLETE',
          message: `Para ativar a vitrine, falta: ${missing.join(', ')}`,
        });
      }
    }

    if (Object.keys(data).length === 0) {
      return this.toShowcase(existing);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.update({
        where: { id: actor.cid },
        data,
      });
      await this.audit.write(tx, {
        companyId: actor.cid,
        actorUserId: actor.sub,
        action: 'COMPANY_SHOWCASE_UPDATE',
        targetType: 'COMPANY',
        targetId: company.id,
        before: this.showcaseSnapshot(existing),
        after: this.showcaseSnapshot(company),
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });
      return company;
    });
    return this.toShowcase(updated);
  }

  private normalizeWhatsapp(value: string): string {
    const phone = normalizePhone(value);
    if (!/^\+?\d{10,15}$/.test(phone)) {
      throw new BadRequestException('WhatsApp inválido');
    }
    return phone;
  }

  private toShowcase(company: Company) {
    return {
      slug: company.slug,
      publicWhatsapp: company.publicWhatsapp,
      publicAddress: company.publicAddress,
      city: company.city,
      showcaseEnabled: company.showcaseEnabled,
      showcaseTermsAcceptedAt: company.showcaseTermsAcceptedAt,
      termsVersion: SHOWCASE_TERMS_VERSION,
    };
  }

  private showcaseSnapshot(company: Company) {
    return {
      publicWhatsapp: company.publicWhatsapp,
      publicAddress: company.publicAddress,
      city: company.city,
      showcaseEnabled: company.showcaseEnabled,
      showcaseTermsAcceptedAt:
        company.showcaseTermsAcceptedAt?.toISOString() ?? null,
    };
  }

  private toSettings(company: Company) {
    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      timezone: company.timezone,
      locale: company.locale,
      businessHours: company.businessHours,
      logoUrl: company.logoUrl,
      currency: company.currency,
      updatedAt: company.updatedAt,
    };
  }

  private snapshot(company: Company) {
    return {
      name: company.name,
      slug: company.slug,
      timezone: company.timezone,
      locale: company.locale,
      businessHours: company.businessHours,
      logoUrl: company.logoUrl,
      currency: company.currency,
    };
  }

  private rethrowSlugConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'COMPANY_SLUG_CONFLICT',
        message: 'Company slug already in use',
      });
    }
  }
}
