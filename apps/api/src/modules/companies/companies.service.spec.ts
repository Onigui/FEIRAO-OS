import { ConflictException, NotFoundException } from '@nestjs/common';
import { CompanyCurrency, Prisma } from '@prisma/client';
import { CompaniesService } from './companies.service';

describe('CompaniesService', () => {
  const actor = { sub: 'user-1', cid: 'co-1', role: 'OWNER' } as never;
  const company = {
    id: 'co-1',
    name: 'Acme',
    slug: 'acme',
    timezone: 'America/Sao_Paulo',
    locale: 'pt-BR',
    businessHours: null,
    logoUrl: null,
    currency: CompanyCurrency.BRL,
    updatedAt: new Date('2026-08-04T00:00:00.000Z'),
  };

  function build(overrides?: {
    findFirst?: jest.Mock;
    update?: jest.Mock;
    transaction?: jest.Mock;
  }) {
    const audit = { write: jest.fn().mockResolvedValue({ id: 'a1' }) };
    const prisma = {
      company: {
        findFirst: overrides?.findFirst ?? jest.fn().mockResolvedValue(company),
        update: overrides?.update ?? jest.fn(),
      },
      $transaction:
        overrides?.transaction ??
        jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
          fn({
            company: {
              update: jest.fn().mockResolvedValue({
                ...company,
                name: 'Acme Updated',
                currency: CompanyCurrency.USD,
              }),
            },
            auditLog: { create: jest.fn() },
          }),
        ),
    };
    return {
      service: new CompaniesService(prisma as never, audit as never),
      audit,
      prisma,
    };
  }

  it('getSettings returns mapped fields', async () => {
    const { service } = build();
    const result = await service.getSettings(actor);
    expect(result).toMatchObject({
      id: 'co-1',
      name: 'Acme',
      currency: CompanyCurrency.BRL,
      locale: 'pt-BR',
    });
  });

  it('getSettings 404 when missing', async () => {
    const { service } = build({
      findFirst: jest.fn().mockResolvedValue(null),
    });
    await expect(service.getSettings(actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updateSettings writes COMPANY_SETTINGS_UPDATE', async () => {
    const { service, audit } = build();
    const result = await service.updateSettings(actor, {
      name: 'Acme Updated',
      currency: CompanyCurrency.USD,
    });
    expect(result.name).toBe('Acme Updated');
    expect(audit.write).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'COMPANY_SETTINGS_UPDATE' }),
    );
  });

  it('maps slug unique conflict', async () => {
    const { service } = build({
      transaction: jest.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      ),
    });
    await expect(
      service.updateSettings(actor, { slug: 'taken' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('CompaniesService — vitrine', () => {
  const actor = { sub: 'user-1', cid: 'co-1', role: 'OWNER' } as never;
  const base = {
    id: 'co-1',
    name: 'Loja',
    slug: 'loja',
    publicWhatsapp: null as string | null,
    publicAddress: null as string | null,
    city: null as string | null,
    showcaseEnabled: false,
    showcaseTermsAcceptedAt: null as Date | null,
    deletedAt: null,
  };

  function build(existing: Record<string, unknown>) {
    const audit = { write: jest.fn().mockResolvedValue({ id: 'a1' }) };
    const update = jest.fn(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...existing,
        ...data,
      }),
    );
    const prisma = {
      company: { findFirst: jest.fn().mockResolvedValue(existing) },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ company: { update }, auditLog: { create: jest.fn() } }),
      ),
    };
    return {
      service: new CompaniesService(prisma as never, audit as never),
      update,
      audit,
    };
  }

  it('normaliza o WhatsApp e grava cidade e endereço', async () => {
    const { service, update, audit } = build(base);
    const res = await service.updateShowcase(actor, {
      publicWhatsapp: '(14) 99999-0000',
      city: 'Botucatu',
      publicAddress: 'Av. X, 1',
    });
    expect(update.mock.calls[0][0].data).toMatchObject({
      publicWhatsapp: '14999990000',
      city: 'Botucatu',
      publicAddress: 'Av. X, 1',
    });
    expect(res.publicWhatsapp).toBe('14999990000');
    expect(audit.write).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'COMPANY_SHOWCASE_UPDATE' }),
    );
  });

  it('recusa WhatsApp curto', async () => {
    const { service } = build(base);
    await expect(
      service.updateShowcase(actor, { publicWhatsapp: '1234-5678' }),
    ).rejects.toThrow('WhatsApp inválido');
  });

  it('não ativa a vitrine sem os dados obrigatórios e lista o que falta', async () => {
    const { service, update } = build({ ...base, slug: null });
    await expect(
      service.updateShowcase(actor, { showcaseEnabled: true }),
    ).rejects.toMatchObject({
      response: {
        code: 'SHOWCASE_INCOMPLETE',
        message:
          'Para ativar a vitrine, falta: endereço da vitrine (em Configurações), WhatsApp público, cidade, aceite do termo de uso',
      },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('ativa a vitrine quando tudo está preenchido na mesma chamada', async () => {
    const { service, update } = build(base);
    const res = await service.updateShowcase(actor, {
      publicWhatsapp: '14 99999-0000',
      city: 'Botucatu',
      acceptTerms: true,
      showcaseEnabled: true,
    });
    expect(res.showcaseEnabled).toBe(true);
    expect(res.showcaseTermsAcceptedAt).toBeInstanceOf(Date);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('não sobrescreve a data do aceite já registrado', async () => {
    const accepted = new Date('2026-10-01T00:00:00Z');
    const { service, update } = build({
      ...base,
      showcaseTermsAcceptedAt: accepted,
    });
    await service.updateShowcase(actor, {
      acceptTerms: true,
      city: 'Botucatu',
    });
    expect(update.mock.calls[0][0].data).not.toHaveProperty(
      'showcaseTermsAcceptedAt',
    );
  });

  it('desativar não exige os dados', async () => {
    const { service } = build({ ...base, showcaseEnabled: true });
    const res = await service.updateShowcase(actor, { showcaseEnabled: false });
    expect(res.showcaseEnabled).toBe(false);
  });
});
