import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { TrackEventDto } from './dto/track-event.dto';
import { PublicShowcaseService } from './public-showcase.service';

/** Dia em São Paulo (YYYY-MM-DD): o hash da sessão muda todo dia. */
export function saoPauloDay(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function sessionHash(session: string, now = new Date()): string {
  return createHash('sha256')
    .update(`${saoPauloDay(now)}:${session}`)
    .digest('hex');
}

/**
 * Analytics anônimo: tipo, loja, carro e uma sessão sem dado pessoal.
 * Tabela sem RLS e fora da extensão de tenant; leitura só por serviço filtrado por loja.
 */
@Injectable()
export class ShowcaseAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly showcase: PublicShowcaseService,
  ) {}

  async track(dto: TrackEventDto): Promise<void> {
    let companyId: string | null = null;
    let vehicleId: string | null = null;
    let fairId: string | null = null;

    if (dto.vehicleSlug) {
      const v = await this.showcase.resolveVehicle(dto.vehicleSlug);
      if (!v) return;
      companyId = v.companyId;
      vehicleId = v.id;
      if (dto.fairSlug) {
        fairId =
          (await this.showcase.resolveFairForVehicle(dto.fairSlug, v.id))?.id ??
          null;
      }
    } else if (dto.fairSlug) {
      fairId = await this.showcase.resolveFairId(dto.fairSlug);
      if (!fairId) return;
    } else if (dto.storeSlug) {
      companyId = await this.showcase.resolveStoreId(dto.storeSlug);
      if (!companyId) return;
    }

    await this.prisma.showcaseAnalyticsEvent.create({
      data: {
        type: dto.type,
        companyId,
        vehicleId,
        fairId,
        sessionHash: sessionHash(dto.session),
      },
    });
  }
}
