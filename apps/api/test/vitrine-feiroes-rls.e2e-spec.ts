/**
 * Vitrine e Feirões — RLS (etapa 1).
 *
 * O Postgres do CI roda como superusuário, que ignora RLS. Cada cenário roda numa
 * transação com `SET LOCAL ROLE vf_rls_tester` (papel sem BYPASSRLS), então as
 * políticas de prisma/migrations/*_vitrine_feiroes_v1 são realmente avaliadas.
 */
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';

const ROLE = 'vf_rls_tester';

type Ctx = { company?: string; publicRead?: boolean };
type Tx = Prisma.TransactionClient;

const run = randomUUID().slice(0, 8);
const A = randomUUID(); // organizadora
const B = randomUUID(); // convidada
const C = randomUUID(); // fora do feirão, sem vitrine
const VA1 = randomUUID();
const VB1 = randomUUID();
const VB2 = randomUUID(); // arquivado
const VC1 = randomUUID();
const FAIR = randomUUID();
const FAIR2 = randomUUID();
const LEAD_B = randomUUID();

describe('Vitrine e Feirões — RLS (e2e)', () => {
  const db = new PrismaClient();

  async function as<T>(ctx: Ctx, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${ROLE}`);
      await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'off', true), set_config('app.public_read', ${ctx.publicRead ? 'on' : 'off'}, true), set_config('app.company_id', ${ctx.company ?? ''}, true)`;
      return fn(tx);
    });
  }

  async function count(ctx: Ctx, table: string): Promise<number> {
    return as(ctx, async (tx) => {
      const rows = await tx.$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT count(*)::bigint AS n FROM "${table}" WHERE ${scope(table)}`,
      );
      return Number(rows[0].n);
    });
  }

  /** Limita a contagem às linhas desta execução (o banco do CI é compartilhado). */
  function scope(table: string): string {
    const ids = [A, B, C].map((id) => `'${id}'`).join(',');
    switch (table) {
      case 'vehicles':
      case 'leads':
      case 'lead_vehicle_interests':
        return `company_id IN (${ids})`;
      case 'fairs':
        return `id IN ('${FAIR}','${FAIR2}')`;
      case 'fair_participants':
      case 'fair_vehicles':
        return `fair_id IN ('${FAIR}','${FAIR2}')`;
      default:
        throw new Error(table);
    }
  }

  async function slugs(ctx: Ctx): Promise<string> {
    return as(ctx, async (tx) => {
      const rows = await tx.$queryRawUnsafe<{ slug: string }[]>(
        `SELECT slug FROM vehicles WHERE ${scope('vehicles')} ORDER BY slug`,
      );
      return rows.map((r) => r.slug.replace(`-${run}`, '')).join(',');
    });
  }

  async function exec(ctx: Ctx, sql: string): Promise<number> {
    return as(ctx, (tx) => tx.$executeRawUnsafe(sql));
  }

  const vehicleCols =
    '(id, company_id, slug, showcase_code, make, model, year_manufacture, year_model, price_cents, mileage_km, transmission, fuel, status, updated_at)';
  const vehicleRow = (
    id: string,
    company: string,
    slug: string,
    status: string,
  ) =>
    `('${id}','${company}','${slug}-${run}','${slug.toUpperCase()}${run.slice(0, 4).toUpperCase()}','Fiat','Uno',2020,2020,5000000,10000,'MANUAL','FLEX','${status}',now())`;

  beforeAll(async () => {
    await db.$executeRawUnsafe(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ROLE}') THEN
        CREATE ROLE ${ROLE} NOLOGIN NOSUPERUSER NOBYPASSRLS;
      END IF;
    END $$;`);
    await db
      .$executeRawUnsafe(`GRANT ${ROLE} TO CURRENT_USER`)
      .catch(() => undefined);
    await db.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${ROLE}`);
    await db.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${ROLE}`,
    );
    await db.$executeRawUnsafe(
      `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${ROLE}`,
    );

    await db.$executeRawUnsafe(`INSERT INTO companies (id, name, slug, updated_at, showcase_enabled) VALUES
      ('${A}','RLS A ${run}','rls-a-${run}',now(),true),
      ('${B}','RLS B ${run}','rls-b-${run}',now(),true),
      ('${C}','RLS C ${run}','rls-c-${run}',now(),false)`);
    await db.$executeRawUnsafe(`INSERT INTO vehicles ${vehicleCols} VALUES
      ${vehicleRow(VA1, A, 'a1', 'AVAILABLE')},
      ${vehicleRow(VB1, B, 'b1', 'AVAILABLE')},
      ${vehicleRow(VB2, B, 'b2', 'ARCHIVED')},
      ${vehicleRow(VC1, C, 'c1', 'AVAILABLE')}`);
    await db.$executeRawUnsafe(`INSERT INTO fairs (id, company_id, name, slug, starts_at, ends_at, venue, status, updated_at) VALUES
      ('${FAIR}','${A}','Feirão','feirao-${run}',now(),now() + interval '2 days','Pátio','DRAFT',now()),
      ('${FAIR2}','${A}','Outro','outro-${run}',now(),now() + interval '2 days','Pátio','DRAFT',now())`);
    await db.$executeRawUnsafe(`INSERT INTO fair_participants (id, fair_id, company_id, organizer_company_id, status) VALUES
      ('${randomUUID()}','${FAIR}','${A}','${A}','ACCEPTED')`);
  });

  afterAll(async () => {
    const ids = `'${A}','${B}','${C}'`;
    await db.$executeRawUnsafe(
      `DELETE FROM lead_vehicle_interests WHERE company_id IN (${ids})`,
    );
    await db.$executeRawUnsafe(
      `DELETE FROM fair_vehicles WHERE fair_id IN ('${FAIR}','${FAIR2}')`,
    );
    await db.$executeRawUnsafe(
      `DELETE FROM fair_participants WHERE fair_id IN ('${FAIR}','${FAIR2}')`,
    );
    await db.$executeRawUnsafe(
      `DELETE FROM fairs WHERE id IN ('${FAIR}','${FAIR2}')`,
    );
    await db.$executeRawUnsafe(
      `DELETE FROM vehicles WHERE company_id IN (${ids})`,
    );
    await db.$executeRawUnsafe(
      `DELETE FROM leads WHERE company_id IN (${ids})`,
    );
    await db.$executeRawUnsafe(`DELETE FROM companies WHERE id IN (${ids})`);
    await db.$disconnect();
  });

  // Os cenários dependem da ordem (convite → aceite → inscrição), como no script SQL de referência.

  it('T01 B vê só os próprios carros', async () => {
    expect(await count({ company: B }, 'vehicles')).toBe(2);
  });

  it('T02 B não altera carro de A', async () => {
    expect(
      await exec(
        { company: B },
        `UPDATE vehicles SET price_cents = 1 WHERE id = '${VA1}'`,
      ),
    ).toBe(0);
  });

  it('T03 B não cria carro em nome de A', async () => {
    await expect(
      exec(
        { company: B },
        `INSERT INTO vehicles ${vehicleCols} VALUES ${vehicleRow(randomUUID(), A, 'x', 'AVAILABLE')}`,
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('T04 público vê carros publicados de lojas com vitrine (a1, b1)', async () => {
    expect(await slugs({ publicRead: true })).toBe('a1,b1');
  });

  it('T05 público não vê feirão em rascunho', async () => {
    expect(await count({ publicRead: true }, 'fairs')).toBe(0);
  });

  it('T06 sem flag e sem loja não vê nada', async () => {
    expect(await count({}, 'vehicles')).toBe(0);
  });

  it('T07 A convida B', async () => {
    expect(
      await exec(
        { company: A },
        `INSERT INTO fair_participants (id, fair_id, company_id, organizer_company_id) VALUES ('${randomUUID()}','${FAIR}','${B}','${A}')`,
      ),
    ).toBe(1);
  });

  it('T08 C não se inscreve sozinha no feirão de A', async () => {
    await expect(
      exec(
        { company: C },
        `INSERT INTO fair_participants (id, fair_id, company_id, organizer_company_id) VALUES ('${randomUUID()}','${FAIR}','${C}','${A}')`,
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('T09 C não se inscreve fingindo ser organizadora', async () => {
    await expect(
      exec(
        { company: C },
        `INSERT INTO fair_participants (id, fair_id, company_id, organizer_company_id) VALUES ('${randomUUID()}','${FAIR}','${C}','${C}')`,
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('T10 B (convidada) vê o feirão em rascunho', async () => {
    expect(await count({ company: B }, 'fairs')).toBe(1);
  });

  it('T11 C não vê feirão nem participantes', async () => {
    expect(await count({ company: C }, 'fairs')).toBe(0);
    expect(await count({ company: C }, 'fair_participants')).toBe(0);
  });

  it('T12 B ainda convidada não inscreve carro', async () => {
    await expect(
      exec(
        { company: B },
        `INSERT INTO fair_vehicles (id, fair_id, vehicle_id, company_id, organizer_company_id, price_cents_at_fair, qr_code) VALUES ('${randomUUID()}','${FAIR}','${VB1}','${B}','${A}',5000000,'Q1${run}')`,
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('T13 B aceita o convite', async () => {
    expect(
      await exec(
        { company: B },
        `UPDATE fair_participants SET status = 'ACCEPTED' WHERE fair_id = '${FAIR}' AND company_id = '${B}'`,
      ),
    ).toBe(1);
  });

  it('T14 B inscreve carro próprio', async () => {
    expect(
      await exec(
        { company: B },
        `INSERT INTO fair_vehicles (id, fair_id, vehicle_id, company_id, organizer_company_id, price_cents_at_fair, qr_code) VALUES ('${randomUUID()}','${FAIR}','${VB1}','${B}','${A}',5000000,'Q1${run}')`,
      ),
    ).toBe(1);
  });

  it('T15 B não inscreve carro de A', async () => {
    await expect(
      exec(
        { company: B },
        `INSERT INTO fair_vehicles (id, fair_id, vehicle_id, company_id, organizer_company_id, price_cents_at_fair, qr_code) VALUES ('${randomUUID()}','${FAIR}','${VA1}','${B}','${A}',5000000,'Q2${run}')`,
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('T16 A (organizadora) vê a1 e o b1 inscrito, mas não b2', async () => {
    expect(await slugs({ company: A })).toBe('a1,b1');
  });

  it('T17 A não altera carro de B', async () => {
    expect(
      await exec(
        { company: A },
        `UPDATE vehicles SET price_cents = 1 WHERE id = '${VB1}'`,
      ),
    ).toBe(0);
  });

  it('T18 ninguém troca o organizador de uma participação', async () => {
    await expect(
      exec(
        { company: A },
        `UPDATE fair_participants SET organizer_company_id = '${C}' WHERE fair_id = '${FAIR}' AND company_id = '${B}'`,
      ),
    ).rejects.toThrow(/fair link columns are immutable/);
  });

  it('T19 B cria lead e interesse ligado ao feirão de A', async () => {
    await as({ company: B }, async (tx) => {
      await tx.$executeRawUnsafe(
        `INSERT INTO leads (id, company_id, name, phone, updated_at) VALUES ('${LEAD_B}','${B}','Visitante','+5514999${run.replace(/\D/g, '0').slice(0, 6)}',now())`,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO lead_vehicle_interests (id, company_id, lead_id, vehicle_id, fair_id, fair_organizer_company_id, intent, source, consent_contact_at, consent_text_version) VALUES ('${randomUUID()}','${B}','${LEAD_B}','${VB1}','${FAIR}','${A}','INTEREST','QR',now(),'v1')`,
      );
    });
  });

  it('T20 B não grava interesse com organizador falso', async () => {
    await expect(
      exec(
        { company: B },
        `INSERT INTO lead_vehicle_interests (id, company_id, lead_id, fair_id, fair_organizer_company_id, intent, source, consent_contact_at, consent_text_version) VALUES ('${randomUUID()}','${B}','${LEAD_B}','${FAIR}','${C}','INTEREST','QR',now(),'v1')`,
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('T21 A conta o interesse do feirão mas não lê o lead de B', async () => {
    expect(await count({ company: A }, 'lead_vehicle_interests')).toBe(1);
    expect(await count({ company: A }, 'leads')).toBe(0);
  });

  it('T22 C não vê interesses nem leads', async () => {
    expect(await count({ company: C }, 'lead_vehicle_interests')).toBe(0);
    expect(await count({ company: C }, 'leads')).toBe(0);
  });

  it('T23 público vê feirão publicado, participantes aceitos e carros inscritos', async () => {
    await db.$executeRawUnsafe(
      `UPDATE fairs SET status = 'PUBLISHED' WHERE id = '${FAIR}'`,
    );
    expect(await count({ publicRead: true }, 'fairs')).toBe(1);
    expect(await count({ publicRead: true }, 'fair_participants')).toBe(2);
    expect(await count({ publicRead: true }, 'fair_vehicles')).toBe(1);
  });

  it('T24 público não vê interesses nem leads', async () => {
    expect(await count({ publicRead: true }, 'lead_vehicle_interests')).toBe(0);
    expect(await count({ publicRead: true }, 'leads')).toBe(0);
  });

  it('T25 B não se auto-convida para outro feirão de A', async () => {
    await expect(
      exec(
        { company: B },
        `INSERT INTO fair_participants (id, fair_id, company_id, organizer_company_id, status) VALUES ('${randomUUID()}','${FAIR2}','${B}','${A}','ACCEPTED')`,
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('T26 organizador não remove carro inscrito por B', async () => {
    expect(
      await exec(
        { company: A },
        `DELETE FROM fair_vehicles WHERE fair_id = '${FAIR}'`,
      ),
    ).toBe(0);
  });
});
