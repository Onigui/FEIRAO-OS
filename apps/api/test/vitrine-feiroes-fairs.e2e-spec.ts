/**
 * Vitrine e Feirões — feirões entre lojas (etapa 4): convite, carros, QR,
 * status, contato atribuído ao feirão, vendido no feirão e relatório.
 */
import { randomInt } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { MembershipRole, PrismaClient } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  upsertCompany,
  upsertMembership,
  upsertUser,
} from '../prisma/seeds/shared/factories';
import { authAs } from './helpers/auth';
import {
  createE2eApp,
  E2E_COMPANY_SLUG,
  E2E_PASSWORD,
} from './helpers/e2e-app';

type Fair = {
  id: string;
  slug: string;
  status: string;
  nextStatus: string | null;
  isOrganizer: boolean;
  participants: { companyId: string; status: string; vehicles: number }[];
};

describe('Vitrine e Feirões — feirões (e2e)', () => {
  let app: INestApplication<App>;
  const db = new PrismaClient();
  const tag = String(randomInt(100_000, 999_999));
  const slugB = `loja-b-${tag}`;
  const emailB = `owner-b-${tag}@test.autopilot.dev`;
  let tokenA: string;
  let tokenB: string;
  let companyA: string;
  let companyB: string;
  let fair: Fair;
  const vehicleIds: string[] = [];
  const phones: string[] = [];

  const api = () => request(app.getHttpServer());
  const as = (token: string, r: request.Test) =>
    r.set('Authorization', `Bearer ${token}`);

  async function createVehicle(token: string, model: string) {
    const res = await as(token, api().post('/api/inventory/vehicles'))
      .send({
        make: `Fe${tag}`,
        model,
        yearManufacture: 2019,
        yearModel: 2020,
        priceCents: 4_500_000,
        mileageKm: 60_000,
        transmission: 'MANUAL',
        fuel: 'FLEX',
      })
      .expect(201);
    const body = res.body as { id: string; slug: string };
    vehicleIds.push(body.id);
    return body;
  }

  const enableShowcase = (token: string) =>
    as(token, api().patch('/api/settings/company/showcase'))
      .send({
        publicWhatsapp: '(14) 99888-7777',
        city: 'Botucatu',
        acceptTerms: true,
        showcaseEnabled: true,
      })
      .expect(200);

  beforeAll(async () => {
    process.env.SHOWCASE_INTEREST_LIMIT_PER_MIN = '1000';
    app = await createE2eApp();
    tokenA = await authAs(app);
    companyA = (
      await db.company.findFirstOrThrow({ where: { slug: E2E_COMPANY_SLUG } })
    ).id;
    await enableShowcase(tokenA);

    const b = await upsertCompany(db, {
      slug: slugB,
      name: `Loja B ${tag}`,
      profile: 'test',
    });
    companyB = b.id;
    const userB = await upsertUser(db, { email: emailB, name: 'Owner B' });
    await upsertMembership(db, {
      companyId: b.id,
      userId: userB.id,
      role: MembershipRole.OWNER,
      invitedBy: userB.id,
    });
    tokenB = await authAs(app, emailB, E2E_PASSWORD, slugB);
  });

  afterAll(async () => {
    const ids = vehicleIds.map((id) => `'${id}'`).join(',');
    if (fair?.id) {
      await db.$executeRawUnsafe(
        `DELETE FROM showcase_analytics_events WHERE fair_id = '${fair.id}'`,
      );
      await db.$executeRawUnsafe(
        `DELETE FROM lead_vehicle_interests WHERE fair_id = '${fair.id}'`,
      );
      await db.$executeRawUnsafe(
        `DELETE FROM fair_vehicles WHERE fair_id = '${fair.id}'`,
      );
      await db.$executeRawUnsafe(
        `DELETE FROM fair_participants WHERE fair_id = '${fair.id}'`,
      );
      await db.$executeRawUnsafe(`DELETE FROM fairs WHERE id = '${fair.id}'`);
    }
    if (phones.length) {
      const p = phones.map((x) => `'${x}'`).join(',');
      await db.$executeRawUnsafe(
        `DELETE FROM lead_status_transitions WHERE lead_id IN (SELECT id FROM leads WHERE phone IN (${p}))`,
      );
      await db.$executeRawUnsafe(`DELETE FROM leads WHERE phone IN (${p})`);
    }
    if (ids) {
      await db.$executeRawUnsafe(
        `DELETE FROM showcase_analytics_events WHERE vehicle_id IN (${ids})`,
      );
      await db.$executeRawUnsafe(
        `DELETE FROM vehicle_status_transitions WHERE vehicle_id IN (${ids})`,
      );
      await db.$executeRawUnsafe(`DELETE FROM vehicles WHERE id IN (${ids})`);
    }
    await db.$executeRawUnsafe(
      `UPDATE companies SET showcase_enabled = false WHERE id = '${companyA}'`,
    );
    await db.$disconnect();
    if (app) await app.close();
  });

  it('cria feirão em rascunho com o organizador já participando', async () => {
    const now = Date.now();
    await as(tokenA, api().post('/api/fairs'))
      .send({
        name: 'Feirão Teste',
        startsAt: new Date(now + 3_600_000).toISOString(),
        endsAt: new Date(now).toISOString(),
        venue: 'Pátio',
      })
      .expect(400);

    const res = await as(tokenA, api().post('/api/fairs'))
      .send({
        name: `Feirão de Teste ${tag}`,
        startsAt: new Date(now - 3_600_000).toISOString(),
        endsAt: new Date(now + 8 * 3_600_000).toISOString(),
        venue: 'Pátio da AF',
        address: 'Av. Teste, 100',
      })
      .expect(201);
    fair = res.body as Fair;
    expect(fair).toEqual(
      expect.objectContaining({
        status: 'DRAFT',
        nextStatus: 'PUBLISHED',
        isOrganizer: true,
      }),
    );
    expect(fair.slug).toMatch(
      /^feirao-de-teste-\d+-\d{4}-\d{2}-\d{2}-[a-z0-9]{4}$/,
    );
    expect(fair.participants).toEqual([
      expect.objectContaining({ companyId: companyA, status: 'ACCEPTED' }),
    ]);

    // Rascunho não aparece para o público.
    await api().get(`/api/public/fairs/${fair.slug}`).expect(404);
  });

  it('convida loja; ela só aceita com a vitrine ativa', async () => {
    const stores = await as(tokenA, api().get('/api/fairs/stores'))
      .query({ q: `Loja B ${tag}` })
      .expect(200);
    expect((stores.body as { id: string }[]).map((s) => s.id)).toContain(
      companyB,
    );

    await as(tokenA, api().post(`/api/fairs/${fair.id}/invites`))
      .send({ companyIds: [companyB] })
      .expect(200);

    const list = await as(tokenB, api().get('/api/fairs')).expect(200);
    expect(
      (list.body as { invites: { id: string }[] }).invites.map((f) => f.id),
    ).toContain(fair.id);

    const refused = await as(
      tokenB,
      api().post(`/api/fairs/${fair.id}/respond`),
    )
      .send({ accept: true })
      .expect(400);
    expect(JSON.stringify(refused.body)).toContain('SHOWCASE_REQUIRED');

    await enableShowcase(tokenB);
    const ok = await as(tokenB, api().post(`/api/fairs/${fair.id}/respond`))
      .send({ accept: true })
      .expect(200);
    expect((ok.body as Fair).isOrganizer).toBe(false);

    // Convidada não muda status nem convida.
    await as(tokenB, api().post(`/api/fairs/${fair.id}/status`))
      .send({ toStatus: 'PUBLISHED' })
      .expect(403);
    await as(tokenB, api().post(`/api/fairs/${fair.id}/invites`))
      .send({ companyIds: [companyA] })
      .expect(403);
  });

  it('cada loja inscreve só os próprios carros disponíveis', async () => {
    const vA = await createVehicle(tokenA, 'CarroA');
    const vB = await createVehicle(tokenB, 'CarroB');
    const vBsold = await createVehicle(tokenB, 'JaVendido');
    await as(tokenB, api().post(`/api/inventory/vehicles/${vBsold.id}/status`))
      .send({ toStatus: 'SOLD' })
      .expect(200);

    await as(tokenB, api().post(`/api/fairs/${fair.id}/vehicles`))
      .send({ vehicleIds: [vA.id] })
      .expect(400);
    await as(tokenB, api().post(`/api/fairs/${fair.id}/vehicles`))
      .send({ vehicleIds: [vBsold.id] })
      .expect(409);

    const added = await as(tokenB, api().post(`/api/fairs/${fair.id}/vehicles`))
      .send({ vehicleIds: [vB.id, vB.id] })
      .expect(200);
    expect(added.body).toEqual(expect.objectContaining({ added: 1 }));
    await as(tokenA, api().post(`/api/fairs/${fair.id}/vehicles`))
      .send({ vehicleIds: [vA.id] })
      .expect(200);

    // Repetir não duplica.
    const again = await as(tokenB, api().post(`/api/fairs/${fair.id}/vehicles`))
      .send({ vehicleIds: [vB.id] })
      .expect(200);
    expect(again.body).toEqual(
      expect.objectContaining({ added: 0, skipped: 1 }),
    );

    const detail = await as(tokenA, api().get(`/api/fairs/${fair.id}`)).expect(
      200,
    );
    const parts = (detail.body as Fair).participants;
    expect(parts.find((p) => p.companyId === companyB)).toEqual(
      expect.objectContaining({ status: 'ACCEPTED', vehicles: 1 }),
    );
  });

  it('status só avança; publicado aparece para o público com o selo no carro', async () => {
    await as(tokenA, api().post(`/api/fairs/${fair.id}/status`))
      .send({ toStatus: 'LIVE' })
      .expect(409);
    const pub = await as(tokenA, api().post(`/api/fairs/${fair.id}/status`))
      .send({ toStatus: 'PUBLISHED' })
      .expect(200);
    expect((pub.body as Fair).status).toBe('PUBLISHED');

    const page = await api().get(`/api/public/fairs/${fair.slug}`).expect(200);
    const body = page.body as {
      stores: { slug: string }[];
      counts: { vehicles: number };
    };
    expect(body.stores.map((s) => s.slug)).toEqual(
      expect.arrayContaining([E2E_COMPANY_SLUG, slugB]),
    );
    expect(body.counts.vehicles).toBe(2);
    expect(JSON.stringify(body)).not.toContain(companyA);

    const list = await api()
      .get(`/api/public/fairs/${fair.slug}/vehicles`)
      .expect(200);
    expect((list.body as { meta: { total: number } }).meta.total).toBe(2);

    const upcoming = await api().get('/api/public/fairs/upcoming').expect(200);
    expect((upcoming.body as { slug: string }[]).map((f) => f.slug)).toContain(
      fair.slug,
    );

    const car = (
      list.body as { data: { slug: string; store: { slug: string } }[] }
    ).data.find((v) => v.store.slug === slugB)!;
    const detail = await api()
      .get(`/api/public/vehicles/${car.slug}`)
      .expect(200);
    expect(
      (detail.body as { fairs: { slug: string }[] }).fairs.map((f) => f.slug),
    ).toEqual([fair.slug]);
  });

  it('QR: leva ao carro, conta a leitura; contato fica atribuído ao feirão', async () => {
    const qr = await as(tokenB, api().get(`/api/fairs/${fair.id}/qr`)).expect(
      200,
    );
    const cards = (qr.body as { cards: { qrCode: string }[] }).cards;
    expect(cards).toHaveLength(1);
    const code = cards[0].qrCode;
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);

    const allA = await as(tokenA, api().get(`/api/fairs/${fair.id}/qr`))
      .query({ all: 'true' })
      .expect(200);
    expect((allA.body as { cards: unknown[] }).cards).toHaveLength(2);
    const allB = await as(tokenB, api().get(`/api/fairs/${fair.id}/qr`))
      .query({ all: 'true' })
      .expect(200);
    expect((allB.body as { cards: unknown[] }).cards).toHaveLength(1);

    const scan = await api().get(`/api/public/q/${code}`).expect(200);
    const target = scan.body as { fairSlug: string; vehicleSlug: string };
    expect(target.fairSlug).toBe(fair.slug);
    await api().get('/api/public/q/NAOEXISTE').expect(404);

    const n = String(randomInt(10_000_000, 99_999_999));
    phones.push(`55149${n}`);
    await api()
      .post('/api/public/interests')
      .send({
        vehicleSlug: target.vehicleSlug,
        fairSlug: fair.slug,
        source: 'QR',
        name: 'Visitante do Feirão',
        phone: `149${n}`,
        consentContact: true,
      })
      .expect(201);

    const row = await db.leadVehicleInterest.findFirstOrThrow({
      where: { fairId: fair.id },
    });
    expect(row).toEqual(
      expect.objectContaining({
        companyId: companyB,
        fairOrganizerCompanyId: companyA,
        source: 'QR',
      }),
    );
    // O lead é da loja B; o organizador não vê.
    const leadsA = await as(tokenA, api().get('/api/leads'))
      .query({ search: 'Visitante do Feirão' })
      .expect(200);
    expect((leadsA.body as { meta: { total: number } }).meta.total).toBe(0);
    const leadsB = await as(tokenB, api().get('/api/leads'))
      .query({ search: 'Visitante do Feirão' })
      .expect(200);
    expect((leadsB.body as { meta: { total: number } }).meta.total).toBe(1);
  });

  it('ao vivo: vendido conta no feirão, aparece com faixa, entra no relatório', async () => {
    await as(tokenA, api().post(`/api/fairs/${fair.id}/status`))
      .send({ toStatus: 'LIVE' })
      .expect(200);
    const mine = await as(
      tokenB,
      api().get(`/api/fairs/${fair.id}/live`),
    ).expect(200);
    const vB = (mine.body as { vehicles: { vehicle: { id: string } }[] })
      .vehicles[0].vehicle.id;
    await as(tokenB, api().post(`/api/inventory/vehicles/${vB}/status`))
      .send({ toStatus: 'SOLD' })
      .expect(200);

    const live = await as(
      tokenB,
      api().get(`/api/fairs/${fair.id}/live`),
    ).expect(200);
    expect(
      (live.body as { counters: Record<string, number> }).counters,
    ).toEqual(
      expect.objectContaining({
        fairVehicles: 2,
        fairSold: 1,
        myVehicles: 1,
        mySold: 1,
      }),
    );

    const list = await api()
      .get(`/api/public/fairs/${fair.slug}/vehicles`)
      .expect(200);
    const data = (
      list.body as { data: { status: string; soldDuringFair: boolean }[] }
    ).data;
    expect(data[data.length - 1]).toEqual(
      expect.objectContaining({ status: 'SOLD', soldDuringFair: true }),
    );
    const onlyAvailable = await api()
      .get(`/api/public/fairs/${fair.slug}/vehicles`)
      .query({ onlyAvailable: 'true' })
      .expect(200);
    expect((onlyAvailable.body as { meta: { total: number } }).meta.total).toBe(
      1,
    );

    const report = await as(
      tokenA,
      api().get(`/api/fairs/${fair.id}/report`),
    ).expect(200);
    const r = report.body as {
      scope: string;
      totals: Record<string, number>;
      stores: {
        companyId: string;
        soldDuringFair: number;
        interests: number;
        qrScans: number;
      }[];
    };
    expect(r.scope).toBe('ALL_STORES');
    expect(r.totals).toEqual(
      expect.objectContaining({
        stores: 2,
        vehicles: 2,
        soldDuringFair: 1,
        interests: 1,
        qrScans: 1,
      }),
    );
    expect(r.stores.find((s) => s.companyId === companyB)).toEqual(
      expect.objectContaining({ soldDuringFair: 1, interests: 1, qrScans: 1 }),
    );
    expect(JSON.stringify(r)).not.toContain('Visitante do Feirão');

    const reportB = await as(
      tokenB,
      api().get(`/api/fairs/${fair.id}/report`),
    ).expect(200);
    expect((reportB.body as { scope: string; stores: unknown[] }).scope).toBe(
      'MY_STORE',
    );
    expect((reportB.body as { stores: unknown[] }).stores).toHaveLength(1);

    const csv = await as(
      tokenA,
      api().get(`/api/fairs/${fair.id}/report.csv`),
    ).expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('Loja;Carros no feirão;Vendidos no feirão');
  });

  it('encerrado: lista de carros congela', async () => {
    await as(tokenA, api().post(`/api/fairs/${fair.id}/status`))
      .send({ toStatus: 'ENDED' })
      .expect(200);
    await as(tokenA, api().post(`/api/fairs/${fair.id}/status`))
      .send({ toStatus: 'LIVE' })
      .expect(409);
    const extra = await createVehicle(tokenB, 'Tarde');
    await as(tokenB, api().post(`/api/fairs/${fair.id}/vehicles`))
      .send({ vehicleIds: [extra.id] })
      .expect(409);
    const live = await as(
      tokenB,
      api().get(`/api/fairs/${fair.id}/vehicles`),
    ).expect(200);
    const fv = live.body as {
      frozen: boolean;
      vehicles: { fairVehicleId: string }[];
    };
    expect(fv.frozen).toBe(true);
    await as(
      tokenB,
      api().delete(
        `/api/fairs/${fair.id}/vehicles/${fv.vehicles[0].fairVehicleId}`,
      ),
    ).expect(409);
    await as(tokenB, api().post(`/api/fairs/${fair.id}/respond`))
      .send({ accept: false })
      .expect(409);

    // Página pública continua de pé com o resultado.
    const page = await api().get(`/api/public/fairs/${fair.slug}`).expect(200);
    expect(page.body as { status: string; counts: { sold: number } }).toEqual(
      expect.objectContaining({
        status: 'ENDED',
        counts: expect.objectContaining({ sold: 1 }),
      }),
    );
  });
});
