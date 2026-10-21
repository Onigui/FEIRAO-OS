/**
 * Vitrine e Feirões — vitrine pública, contatos → Lead e bloqueio das automações (etapa 3).
 */
import { randomInt, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { OutboundProtectionService } from '../src/modules/outbound/outbound-protection.service';
import { authAs } from './helpers/auth';
import { createE2eApp, E2E_COMPANY_SLUG } from './helpers/e2e-app';

type VehicleBody = { id: string; slug: string; showcaseCode: string };
type PublicList = {
  data: { slug: string; status: string; store: { slug: string } }[];
  meta: { total: number; makes: { make: string; count: number }[] };
};

/** Celular aleatório de Botucatu: (14) 9XXXX-XXXX. */
function randomCell(): { masked: string; stored: string; national: string } {
  const n = String(randomInt(10_000_000, 99_999_999));
  const national = `149${n}`;
  return {
    masked: `(14) 9${n.slice(0, 4)}-${n.slice(4)}`,
    stored: `55${national}`,
    national,
  };
}

describe('Vitrine e Feirões — vitrine pública e contatos (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  let companyId: string;
  const db = new PrismaClient();
  const otherCompanyId = randomUUID();
  const otherVehicleId = randomUUID();
  const otherSlug = `outro-${otherVehicleId.slice(0, 8)}`;
  const tag = `Vit${randomInt(100_000, 999_999)}`;
  const vehicles: string[] = [];
  const leadPhones: string[] = [];

  const api = () => request(app.getHttpServer());
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

  async function createVehicle(model: string): Promise<VehicleBody> {
    const res = await auth(api().post('/api/inventory/vehicles'))
      .send({
        make: tag,
        model,
        yearManufacture: 2020,
        yearModel: 2021,
        priceCents: 5_990_000,
        mileageKm: 45_000,
        transmission: 'MANUAL',
        fuel: 'FLEX',
      })
      .expect(201);
    const body = res.body as VehicleBody;
    vehicles.push(body.id);
    return body;
  }

  const interest = (body: Record<string, unknown>) =>
    api()
      .post('/api/public/interests')
      .send({
        name: 'Maria Teste',
        consentContact: true,
        ...body,
      });

  beforeAll(async () => {
    // Muitos contatos seguidos neste arquivo; o limite real é testado no fim.
    process.env.SHOWCASE_INTEREST_LIMIT_PER_MIN = '1000';
    app = await createE2eApp();
    token = await authAs(app);
    const company = await db.company.findFirstOrThrow({
      where: { slug: E2E_COMPANY_SLUG },
      select: { id: true },
    });
    companyId = company.id;

    await auth(api().patch('/api/settings/company/showcase'))
      .send({
        publicWhatsapp: '(14) 99999-0000',
        city: 'Botucatu',
        acceptTerms: true,
        showcaseEnabled: true,
      })
      .expect(200);

    // Loja sem vitrine ativa, com um carro: nunca aparece no público.
    await db.$executeRawUnsafe(
      `INSERT INTO companies (id, name, slug, updated_at) VALUES ('${otherCompanyId}','Loja fechada','fechada-${otherCompanyId.slice(0, 8)}',now())`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO vehicles (id, company_id, slug, showcase_code, make, model, year_manufacture, year_model, price_cents, mileage_km, transmission, fuel, updated_at)
       VALUES ('${otherVehicleId}','${otherCompanyId}','${otherSlug}','F${otherVehicleId.slice(0, 7).toUpperCase()}','${tag}','Escondido',2015,2015,2000000,90000,'MANUAL','FLEX',now())`,
    );
  });

  afterAll(async () => {
    const ids = [...vehicles, otherVehicleId].map((id) => `'${id}'`).join(',');
    const phones = leadPhones.map((p) => `'${p}'`).join(',');
    await db.$executeRawUnsafe(
      `DELETE FROM showcase_analytics_events WHERE vehicle_id IN (${ids})`,
    );
    await db.$executeRawUnsafe(
      `DELETE FROM lead_vehicle_interests WHERE vehicle_id IN (${ids})`,
    );
    if (phones) {
      await db.$executeRawUnsafe(
        `DELETE FROM outbound_campaign_leads WHERE lead_id IN (SELECT id FROM leads WHERE phone IN (${phones}))`,
      );
      await db.$executeRawUnsafe(
        `DELETE FROM lead_status_transitions WHERE lead_id IN (SELECT id FROM leads WHERE phone IN (${phones}))`,
      );
      await db.$executeRawUnsafe(
        `DELETE FROM leads WHERE phone IN (${phones})`,
      );
    }
    await db.$executeRawUnsafe(
      `DELETE FROM vehicle_status_transitions WHERE vehicle_id IN (${ids})`,
    );
    await db.$executeRawUnsafe(`DELETE FROM vehicles WHERE id IN (${ids})`);
    await db.$executeRawUnsafe(
      `DELETE FROM companies WHERE id = '${otherCompanyId}'`,
    );
    await db.$executeRawUnsafe(
      `UPDATE companies SET showcase_enabled = false WHERE id = '${companyId}'`,
    );
    await db.$disconnect();
    if (app) await app.close();
  });

  it('lista só carros publicados, sem dados internos', async () => {
    const available = await createVehicle('Disponivel');
    const archived = await createVehicle('Arquivado');
    await auth(api().post(`/api/inventory/vehicles/${archived.id}/status`))
      .send({ toStatus: 'ARCHIVED' })
      .expect(200);

    const res = await api()
      .get('/api/public/vehicles')
      .query({ q: tag, limit: 48 })
      .expect(200);
    const body = res.body as PublicList;
    const slugs = body.data.map((v) => v.slug);
    expect(slugs).toContain(available.slug);
    expect(slugs).not.toContain(archived.slug);
    expect(slugs).not.toContain(otherSlug);
    expect(body.meta.makes).toEqual(
      expect.arrayContaining([expect.objectContaining({ make: tag })]),
    );
    const raw = JSON.stringify(body);
    expect(raw).not.toContain(companyId);
    expect(raw).not.toContain(available.id);

    const byStore = await api()
      .get('/api/public/vehicles')
      .query({ store: E2E_COMPANY_SLUG, q: tag })
      .expect(200);
    expect(
      (byStore.body as PublicList).data.every(
        (v) => v.store.slug === E2E_COMPANY_SLUG,
      ),
    ).toBe(true);
  });

  it('página do carro e da loja; carro de loja sem vitrine dá 404', async () => {
    const v = await createVehicle('Detalhe');
    const res = await api().get(`/api/public/vehicles/${v.slug}`).expect(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        slug: v.slug,
        code: v.showcaseCode,
        store: expect.objectContaining({
          slug: E2E_COMPANY_SLUG,
          city: 'Botucatu',
          whatsapp: '5514999990000',
        }),
      }),
    );
    expect(JSON.stringify(res.body)).not.toContain(v.id);

    await api().get(`/api/public/vehicles/${otherSlug}`).expect(404);

    const store = await api()
      .get(`/api/public/stores/${E2E_COMPANY_SLUG}`)
      .expect(200);
    expect(store.body).toEqual(
      expect.objectContaining({ slug: E2E_COMPANY_SLUG, city: 'Botucatu' }),
    );
    await api()
      .get(`/api/public/stores/fechada-${otherCompanyId.slice(0, 8)}`)
      .expect(404);
  });

  it('valida o formulário: autorização 1 obrigatória e WhatsApp com DDD', async () => {
    const v = await createVehicle('Form');
    const phone = randomCell();
    await interest({
      vehicleSlug: v.slug,
      phone: phone.masked,
      consentContact: false,
    }).expect(400);
    await interest({ vehicleSlug: v.slug, phone: '99999-0000' }).expect(400);
    await interest({ vehicleSlug: otherSlug, phone: phone.masked }).expect(404);
    await interest({
      vehicleSlug: v.slug,
      phone: phone.masked,
      companyId,
    }).expect(400);
  });

  it('contato vira Lead da loja, com interesse, autorizações e sem duplicar em 24 h', async () => {
    const v = await createVehicle('Lead');
    const phone = randomCell();
    leadPhones.push(phone.stored);

    const res = await interest({
      vehicleSlug: v.slug,
      phone: phone.masked,
      source: 'VEHICLE_PAGE',
    }).expect(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        ok: true,
        storeName: expect.any(String),
        whatsappUrl: expect.stringContaining(
          'https://wa.me/5514999990000?text=',
        ),
      }),
    );

    const lead = await db.lead.findFirstOrThrow({
      where: { companyId, phone: phone.stored, deletedAt: null },
    });
    expect(lead).toEqual(
      expect.objectContaining({
        name: 'Maria Teste',
        source: 'SHOWCASE',
        status: 'NEW',
      }),
    );
    const rows = await db.leadVehicleInterest.findMany({
      where: { leadId: lead.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        companyId,
        vehicleId: v.id,
        source: 'VEHICLE_PAGE',
        consentTextVersion: 'v1-2026-11',
        consentMarketingAt: null,
      }),
    );
    expect(rows[0].consentContactAt).toBeInstanceOf(Date);

    // Repetição: não cria outro interesse nem outro lead; a autorização 2 é registrada.
    await interest({
      vehicleSlug: v.slug,
      phone: phone.national,
      consentMarketing: true,
    }).expect(201);
    const again = await db.leadVehicleInterest.findMany({
      where: { leadId: lead.id },
    });
    expect(again).toHaveLength(1);
    expect(again[0].consentMarketingAt).toBeInstanceOf(Date);
    expect(
      await db.lead.count({ where: { companyId, phone: phone.stored } }),
    ).toBe(1);

    // Aparece na linha do tempo do lead.
    const timeline = await auth(
      api().get(`/api/leads/${lead.id}/timeline`),
    ).expect(200);
    expect(JSON.stringify(timeline.body)).toContain(
      'SHOWCASE_INTEREST_CREATED',
    );
  });

  it('reaproveita lead que já existia com o telefone sem 55', async () => {
    const v = await createVehicle('Existente');
    const phone = randomCell();
    leadPhones.push(phone.national, phone.stored);
    const created = await auth(api().post('/api/leads'))
      .send({ name: 'Cliente Antigo', phone: phone.national })
      .expect(201);
    const leadId = (created.body as { id: string }).id;

    await interest({ vehicleSlug: v.slug, phone: phone.masked }).expect(201);
    const rows = await db.leadVehicleInterest.findMany({
      where: { vehicleId: v.id },
    });
    expect(rows.map((r) => r.leadId)).toEqual([leadId]);
    const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead.name).toBe('Cliente Antigo');
  });

  it('campo-armadilha: responde ok e não grava nada', async () => {
    const v = await createVehicle('Robo');
    const phone = randomCell();
    await interest({
      vehicleSlug: v.slug,
      phone: phone.masked,
      website: 'http://spam',
    }).expect(201);
    expect(await db.lead.count({ where: { phone: phone.stored } })).toBe(0);
  });

  it('vendido sai da vitrine na hora e não aceita contato', async () => {
    const v = await createVehicle('Vendido');
    await auth(api().post(`/api/inventory/vehicles/${v.id}/status`))
      .send({ toStatus: 'SOLD' })
      .expect(200);
    const list = await api()
      .get('/api/public/vehicles')
      .query({ q: tag, limit: 48 })
      .expect(200);
    expect((list.body as PublicList).data.map((x) => x.slug)).not.toContain(
      v.slug,
    );
    const page = await api().get(`/api/public/vehicles/${v.slug}`).expect(200);
    expect((page.body as { status: string }).status).toBe('SOLD');
    await interest({ vehicleSlug: v.slug, phone: randomCell().masked }).expect(
      409,
    );
  });

  it('automações: sem autorização de ofertas fica fora; com autorização, entra', async () => {
    const v = await createVehicle('Automacao');
    const blocked = randomCell();
    const allowed = randomCell();
    leadPhones.push(blocked.stored, allowed.stored);
    await interest({ vehicleSlug: v.slug, phone: blocked.masked }).expect(201);
    await interest({
      vehicleSlug: v.slug,
      phone: allowed.masked,
      consentMarketing: true,
    }).expect(201);
    const blockedLead = await db.lead.findFirstOrThrow({
      where: { phone: blocked.stored },
    });
    const allowedLead = await db.lead.findFirstOrThrow({
      where: { phone: allowed.stored },
    });

    // Trava de envio proativo (recuperação, first-touch, nutrição).
    const protection = app.get(OutboundProtectionService);
    const gate = await protection.canSendProactive({
      companyId,
      leadId: blockedLead.id,
      source: 'ai_recovery',
    });
    expect(gate).toEqual(
      expect.objectContaining({
        allowed: false,
        reason: 'SHOWCASE_NO_MARKETING_CONSENT',
      }),
    );
    const gateOk = await protection.canSendProactive({
      companyId,
      leadId: allowedLead.id,
      source: 'ai_recovery',
    });
    if (!gateOk.allowed) {
      expect(gateOk.reason).not.toBe('SHOWCASE_NO_MARKETING_CONSENT');
    }

    // Campanha: o lead sem autorização é ignorado e contado.
    const campaign = await auth(api().post('/api/outbound/campaigns'))
      .send({ name: `Campanha ${tag}`, objective: 'teste' })
      .expect(201);
    const campaignId = (campaign.body as { id: string }).id;
    const added = await auth(
      api().post(`/api/outbound/campaigns/${campaignId}/leads`),
    )
      .send({ leadIds: [blockedLead.id, allowedLead.id] })
      .expect(201);
    expect(added.body).toEqual(
      expect.objectContaining({ added: 1, skipped: 1, skippedNoConsent: 1 }),
    );
    await db.$executeRawUnsafe(
      `DELETE FROM outbound_campaign_leads WHERE campaign_id = '${campaignId}'`,
    );
    await db.$executeRawUnsafe(
      `DELETE FROM outbound_campaigns WHERE id = '${campaignId}'`,
    );

    // Painel: interesses por lead mostram o carro e o bloqueio.
    const li = await auth(api().get('/api/showcase/lead-interests'))
      .query({ leadIds: `${blockedLead.id},${allowedLead.id}` })
      .expect(200);
    const map = li.body as Record<
      string,
      { automationBlocked: boolean; vehicle: { code: string } }[]
    >;
    expect(map[blockedLead.id][0]).toEqual(
      expect.objectContaining({
        automationBlocked: true,
        vehicle: expect.objectContaining({ code: v.showcaseCode }),
      }),
    );
    expect(map[allowedLead.id][0].automationBlocked).toBe(false);
  });

  it('analytics anônimo e números da semana no painel', async () => {
    const v = await createVehicle('Analytics');
    const session = 'sessao-teste-123456';
    await api()
      .post('/api/public/analytics')
      .send({ type: 'WHATSAPP_CLICK', vehicleSlug: v.slug, session })
      .expect(204);
    await api()
      .post('/api/public/analytics')
      .send({ type: 'PAGE_VIEW', storeSlug: E2E_COMPANY_SLUG, session })
      .expect(204);
    await api()
      .post('/api/public/analytics')
      .send({ type: 'QR_SCAN', vehicleSlug: v.slug, session })
      .expect(400);

    const events = await db.showcaseAnalyticsEvent.findMany({
      where: { vehicleId: v.id },
    });
    expect(events).toHaveLength(1);
    expect(events[0].companyId).toBe(companyId);
    expect(events[0].sessionHash).toMatch(/^[0-9a-f]{64}$/);
    expect(events[0].sessionHash).not.toContain(session);

    const stats = await auth(api().get('/api/showcase/stats')).expect(200);
    expect(stats.body).toEqual(
      expect.objectContaining({
        availableVehicles: expect.any(Number),
        contactsWeek: expect.any(Number),
        whatsappClicksWeek: expect.any(Number),
        pageViewsWeek: expect.any(Number),
      }),
    );
    expect(
      (stats.body as { whatsappClicksWeek: number }).whatsappClicksWeek,
    ).toBeGreaterThanOrEqual(1);
    await api().get('/api/showcase/stats').expect(401);
  });

  it('limita contatos por IP (429)', async () => {
    const v = await createVehicle('Limite');
    process.env.SHOWCASE_INTEREST_LIMIT_PER_MIN = '1';
    try {
      await interest({ vehicleSlug: v.slug, phone: '1' }).expect(429);
    } finally {
      process.env.SHOWCASE_INTEREST_LIMIT_PER_MIN = '1000';
    }
  });
});
