/**
 * Vitrine e Feirões — API de estoque (etapa 1).
 */
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { authAs } from './helpers/auth';
import { createE2eApp } from './helpers/e2e-app';

type VehicleBody = {
  id: string;
  slug: string;
  showcaseCode: string;
  status: string;
  priceCents: number;
  soldAt: string | null;
  photos: unknown[];
};

const baseVehicle = {
  make: 'Volkswagen',
  model: 'Gol',
  version: '1.0 MPI',
  yearManufacture: 2020,
  yearModel: 2021,
  priceCents: 5_990_000,
  mileageKm: 45_000,
  transmission: 'MANUAL',
  fuel: 'FLEX',
  color: 'Prata',
};

describe('Vitrine e Feirões — estoque (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  const db = new PrismaClient();
  const otherCompanyId = randomUUID();
  const otherVehicleId = randomUUID();
  const created: string[] = [];

  const api = () => request(app.getHttpServer());
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    app = await createE2eApp();
    token = await authAs(app);

    // Veículo de outra loja, criado direto no banco (superusuário do CI).
    await db.$executeRawUnsafe(
      `INSERT INTO companies (id, name, slug, updated_at) VALUES ('${otherCompanyId}','Outra loja','outra-${otherCompanyId.slice(0, 8)}',now())`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO vehicles (id, company_id, slug, showcase_code, make, model, year_manufacture, year_model, price_cents, mileage_km, transmission, fuel, updated_at)
       VALUES ('${otherVehicleId}','${otherCompanyId}','outro-${otherVehicleId.slice(0, 8)}','O${otherVehicleId.slice(0, 7).toUpperCase()}','Fiat','Uno',2015,2015,2000000,90000,'MANUAL','FLEX',now())`,
    );
  });

  afterAll(async () => {
    const ids = [...created, otherVehicleId].map((id) => `'${id}'`).join(',');
    if (ids) {
      await db.$executeRawUnsafe(
        `DELETE FROM vehicle_status_transitions WHERE vehicle_id IN (${ids})`,
      );
      await db.$executeRawUnsafe(`DELETE FROM vehicles WHERE id IN (${ids})`);
    }
    await db.$executeRawUnsafe(
      `DELETE FROM vehicle_status_transitions WHERE vehicle_id IN (SELECT id FROM vehicles WHERE make = 'ImportE2E')`,
    );
    await db.$executeRawUnsafe(`DELETE FROM vehicles WHERE make = 'ImportE2E'`);
    await db.$executeRawUnsafe(
      `DELETE FROM companies WHERE id = '${otherCompanyId}'`,
    );
    await db.$disconnect();
    if (app) await app.close();
  });

  async function createVehicle(
    over: Record<string, unknown> = {},
  ): Promise<VehicleBody> {
    const res = await auth(api().post('/api/inventory/vehicles'))
      .send({ ...baseVehicle, ...over })
      .expect(201);
    const body = res.body as VehicleBody;
    created.push(body.id);
    return body;
  }

  it('exige login', async () => {
    await api().get('/api/inventory/vehicles').expect(401);
  });

  it('cadastra veículo disponível com slug e código curto', async () => {
    const v = await createVehicle();
    expect(v.status).toBe('AVAILABLE');
    expect(v.slug).toMatch(/^volkswagen-gol-2021-[a-z0-9]{6}$/);
    expect(v.showcaseCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(v.photos).toEqual([]);
  });

  it('valida campos e anos', async () => {
    await auth(api().post('/api/inventory/vehicles'))
      .send({ ...baseVehicle, priceCents: 0 })
      .expect(400);
    await auth(api().post('/api/inventory/vehicles'))
      .send({ ...baseVehicle, transmission: 'AUTOMATICO' })
      .expect(400);
    await auth(api().post('/api/inventory/vehicles'))
      .send({ ...baseVehicle, yearManufacture: 2020, yearModel: 2023 })
      .expect(400);
    await auth(api().post('/api/inventory/vehicles'))
      .send({ ...baseVehicle, companyId: otherCompanyId })
      .expect(400);
  });

  it('lista, busca e edita', async () => {
    const v = await createVehicle({ model: 'Polo', yearModel: 2021 });
    const list = await auth(
      api().get('/api/inventory/vehicles').query({ search: 'polo' }),
    ).expect(200);
    expect(
      (list.body as { data: VehicleBody[] }).data.map((x) => x.id),
    ).toContain(v.id);

    const upd = await auth(api().patch(`/api/inventory/vehicles/${v.id}`))
      .send({ priceCents: 5_500_000 })
      .expect(200);
    expect((upd.body as VehicleBody).priceCents).toBe(5_500_000);
  });

  it('não enxerga nem altera veículo de outra loja', async () => {
    const list = await auth(
      api()
        .get('/api/inventory/vehicles')
        .query({ limit: 100, includeArchived: true }),
    ).expect(200);
    expect(
      (list.body as { data: VehicleBody[] }).data.map((x) => x.id),
    ).not.toContain(otherVehicleId);
    await auth(api().get(`/api/inventory/vehicles/${otherVehicleId}`)).expect(
      404,
    );
    await auth(api().patch(`/api/inventory/vehicles/${otherVehicleId}`))
      .send({ priceCents: 1 })
      .expect(404);
    await auth(api().post(`/api/inventory/vehicles/${otherVehicleId}/status`))
      .send({ toStatus: 'SOLD' })
      .expect(404);
  });

  it('fluxo de status: reserva, venda, desfaz venda e histórico', async () => {
    const v = await createVehicle();
    const reserved = await auth(
      api().post(`/api/inventory/vehicles/${v.id}/status`),
    )
      .send({ toStatus: 'RESERVED' })
      .expect(200);
    expect((reserved.body as VehicleBody).status).toBe('RESERVED');

    const sold = await auth(
      api().post(`/api/inventory/vehicles/${v.id}/status`),
    )
      .send({ toStatus: 'SOLD' })
      .expect(200);
    expect((sold.body as VehicleBody).soldAt).toBeTruthy();

    await auth(api().post(`/api/inventory/vehicles/${v.id}/status`))
      .send({ toStatus: 'SOLD' })
      .expect(409);
    await auth(api().post(`/api/inventory/vehicles/${v.id}/status`))
      .send({ toStatus: 'RESERVED' })
      .expect(409);

    const undone = await auth(
      api().post(`/api/inventory/vehicles/${v.id}/status`),
    )
      .send({ toStatus: 'AVAILABLE' })
      .expect(200);
    expect((undone.body as VehicleBody).soldAt).toBeNull();

    const history = await auth(
      api().get(`/api/inventory/vehicles/${v.id}/status-history`),
    ).expect(200);
    expect(
      (history.body as { toStatus: string }[]).map((h) => h.toStatus),
    ).toEqual(['AVAILABLE', 'SOLD', 'RESERVED']);
  });

  it('não desfaz venda depois de 24 horas', async () => {
    const v = await createVehicle();
    await auth(api().post(`/api/inventory/vehicles/${v.id}/status`))
      .send({ toStatus: 'SOLD' })
      .expect(200);
    await db.$executeRawUnsafe(
      `UPDATE vehicles SET sold_at = now() - interval '25 hours' WHERE id = '${v.id}'`,
    );
    await auth(api().post(`/api/inventory/vehicles/${v.id}/status`))
      .send({ toStatus: 'AVAILABLE' })
      .expect(409);
  });

  it('arquivados saem da lista padrão', async () => {
    const v = await createVehicle();
    await auth(api().post(`/api/inventory/vehicles/${v.id}/status`))
      .send({ toStatus: 'ARCHIVED' })
      .expect(200);
    const list = await auth(
      api().get('/api/inventory/vehicles').query({ limit: 100 }),
    ).expect(200);
    expect(
      (list.body as { data: VehicleBody[] }).data.map((x) => x.id),
    ).not.toContain(v.id);
    const all = await auth(
      api()
        .get('/api/inventory/vehicles')
        .query({ limit: 100, includeArchived: true }),
    ).expect(200);
    expect(
      (all.body as { data: VehicleBody[] }).data.map((x) => x.id),
    ).toContain(v.id);
  });

  it('exclusão lógica', async () => {
    const v = await createVehicle();
    await auth(api().delete(`/api/inventory/vehicles/${v.id}`)).expect(204);
    await auth(api().get(`/api/inventory/vehicles/${v.id}`)).expect(404);
    const rows = await db.$queryRawUnsafe<{ deleted_at: Date | null }[]>(
      `SELECT deleted_at FROM vehicles WHERE id = '${v.id}'`,
    );
    expect(rows[0].deleted_at).not.toBeNull();
  });

  it('upload de foto responde 503 quando o R2 não está configurado', async () => {
    const v = await createVehicle();
    await auth(api().post(`/api/inventory/vehicles/${v.id}/photos/upload-url`))
      .send({ contentType: 'image/jpeg', sizeBytes: 1000 })
      .expect(503);
    await auth(api().post(`/api/inventory/vehicles/${v.id}/photos/upload-url`))
      .send({ contentType: 'image/gif', sizeBytes: 1000 })
      .expect(400);
  });

  it('baixa o modelo de planilha em CSV e XLSX', async () => {
    const csv = await auth(
      api().get('/api/inventory/import/template').query({ format: 'csv' }),
    ).expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('marca;modelo;versao;ano_fabricacao');
    const xlsx = await auth(
      api().get('/api/inventory/import/template').query({ format: 'xlsx' }),
    )
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect((xlsx.body as Buffer).subarray(0, 2).toString()).toBe('PK');
  });

  it('importa: prévia com erros por linha e commit só das válidas', async () => {
    const lines = [
      'marca;modelo;ano_fabricacao;ano_modelo;preco;km;cambio;combustivel',
    ];
    for (let i = 0; i < 50; i += 1) {
      lines.push(
        `ImportE2E;Modelo ${i};2019;2020;R$ 45.000,00;30.000;manual;flex`,
      );
    }
    lines[5] = 'ImportE2E;Ruim;2019;2025;R$ 45.000,00;30.000;manual;flex';
    lines[10] = ';SemMarca;2019;2020;R$ 45.000,00;30.000;manual;flex';
    lines[20] =
      'ImportE2E;Cambio;2019;2020;R$ 45.000,00;30.000;sequencial;flex';

    const preview = await auth(api().post('/api/inventory/import/preview'))
      .attach('file', Buffer.from(lines.join('\n'), 'utf8'), 'estoque.csv')
      .expect(200);
    const body = preview.body as {
      totalRows: number;
      valid: { line: number; vehicle: Record<string, unknown> }[];
      errors: { line: number; messages: string[] }[];
    };
    expect(body.totalRows).toBe(50);
    expect(body.valid).toHaveLength(47);
    expect(body.errors.map((e) => e.line)).toEqual([6, 11, 21]);

    const commit = await auth(api().post('/api/inventory/import/commit'))
      .send({ vehicles: body.valid.map((v) => v.vehicle) })
      .expect(201);
    expect(commit.body).toEqual({ imported: 47 });

    const list = await auth(
      api()
        .get('/api/inventory/vehicles')
        .query({ search: 'Modelo', limit: 100 }),
    ).expect(200);
    expect(
      (list.body as { meta: { total: number } }).meta.total,
    ).toBeGreaterThanOrEqual(47);
  });

  it('recusa planilha sem as colunas obrigatórias', async () => {
    const res = await auth(api().post('/api/inventory/import/preview'))
      .attach('file', Buffer.from('marca;modelo\nFiat;Uno\n', 'utf8'), 'x.csv')
      .expect(400);
    expect(JSON.stringify(res.body)).toContain('Colunas obrigatórias ausentes');
  });
});
