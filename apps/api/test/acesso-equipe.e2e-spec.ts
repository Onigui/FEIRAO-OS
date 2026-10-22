/**
 * Etapa 6 — acesso da equipe: link de convite / redefinição (por WhatsApp) e troca de senha.
 */
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { authAs } from './helpers/auth';
import {
  createE2eApp,
  E2E_COMPANY_SLUG,
  E2E_OWNER_EMAIL,
} from './helpers/e2e-app';

type LinkBody = {
  token: string;
  purpose: string;
  expiresAt: string;
  email: string;
};

describe('Acesso da equipe (e2e)', () => {
  let app: INestApplication<App>;
  let ownerToken: string;
  const db = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const memberEmail = `vendedor.${suffix}@acesso-e2e.dev`;
  const existingEmail = `ja-tem-conta.${suffix}@acesso-e2e.dev`;
  const existingPassword = 'SenhaAntiga123';
  const otherCompanyId = randomUUID();
  const existingUserId = randomUUID();
  let memberMembershipId: string;

  const api = () => request(app.getHttpServer());
  const asOwner = (r: request.Test) =>
    r.set('Authorization', `Bearer ${ownerToken}`);

  beforeAll(async () => {
    app = await createE2eApp();
    ownerToken = await authAs(app);

    // Pessoa que já tem conta e está ativa em OUTRA loja.
    const hash = await argon2.hash(existingPassword);
    await db.$executeRawUnsafe(
      `INSERT INTO companies (id, name, slug, updated_at) VALUES ('${otherCompanyId}','Outra loja acesso','outra-acesso-${suffix}',now())`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO users (id, email, name, password_hash, status, updated_at) VALUES ('${existingUserId}','${existingEmail}','Já tem conta','${hash}','ACTIVE',now())`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO memberships (id, company_id, user_id, role, status, joined_at, updated_at) VALUES ('${randomUUID()}','${otherCompanyId}','${existingUserId}','OWNER','ACTIVE',now(),now())`,
    );
  });

  afterAll(async () => {
    await db.$disconnect();
    if (app) await app.close();
  });

  function newLink(membershipId: string, token = ownerToken) {
    return api()
      .post(`/api/memberships/${membershipId}/access-link`)
      .set('Authorization', `Bearer ${token}`);
  }

  function login(email: string, password: string) {
    return api().post('/api/auth/login').send({ email, password });
  }

  it('convite: gera link, o link anterior deixa de valer, pessoa define a senha e entra', async () => {
    const invite = await asOwner(api().post('/api/memberships'))
      .send({ email: memberEmail, name: 'Vendedor Teste', role: 'AGENT' })
      .expect(201);
    memberMembershipId = (invite.body as { id: string }).id;

    const first = (await newLink(memberMembershipId).expect(201))
      .body as LinkBody;
    expect(first.purpose).toBe('INVITE');
    expect(first.token.length).toBeGreaterThanOrEqual(40);

    const second = (await newLink(memberMembershipId).expect(201))
      .body as LinkBody;
    await api().get(`/api/auth/access-links/${first.token}`).expect(404);

    const info = await api()
      .get(`/api/auth/access-links/${second.token}`)
      .expect(200);
    expect(info.body).toMatchObject({
      purpose: 'INVITE',
      mode: 'SET_PASSWORD',
      email: memberEmail,
    });
    expect((info.body as { companyName: string }).companyName).toBeTruthy();

    // Só o hash fica no banco.
    const stored = await db.$queryRawUnsafe<{ token_hash: string }[]>(
      `SELECT token_hash FROM access_links WHERE membership_id = '${memberMembershipId}'`,
    );
    expect(stored.map((r) => r.token_hash)).not.toContain(second.token);

    const weak = await api()
      .post(`/api/auth/access-links/${second.token}/complete`)
      .send({ password: 'somenteletras' })
      .expect(400);
    expect((weak.body as { code: string }).code).toBe('WEAK_PASSWORD');

    await api()
      .post(`/api/auth/access-links/${second.token}/complete`)
      .send({ password: 'NovaSenha123' })
      .expect(200);

    // Uso único.
    await api()
      .post(`/api/auth/access-links/${second.token}/complete`)
      .send({ password: 'OutraSenha123' })
      .expect(404);

    const res = await login(memberEmail, 'NovaSenha123').expect(200);
    const memberships = (res.body as { memberships: { companySlug: string }[] })
      .memberships;
    expect(memberships.map((m) => m.companySlug)).toContain(E2E_COMPANY_SLUG);
  });

  it('vendedor não gera link; ninguém gera link para si mesmo', async () => {
    const agentToken = await authAs(app, memberEmail, 'NovaSenha123');
    const list = await asOwner(api().get('/api/memberships?limit=100')).expect(
      200,
    );
    const ownerRow = (
      list.body as { data: { id: string; role: string; email: string }[] }
    ).data.find((m) => m.email === E2E_OWNER_EMAIL);
    await newLink(ownerRow!.id, agentToken).expect(403);

    const self = await newLink(ownerRow!.id).expect(400);
    expect((self.body as { code: string }).code).toBe('USE_CHANGE_PASSWORD');
  });

  it('redefinir senha: senha antiga para de funcionar e as sessões abertas caem', async () => {
    const before = await login(memberEmail, 'NovaSenha123').expect(200);
    const oldRefresh = (before.body as { refreshToken: string }).refreshToken;

    const link = (await newLink(memberMembershipId).expect(201))
      .body as LinkBody;
    expect(link.purpose).toBe('PASSWORD_RESET');
    await api()
      .post(`/api/auth/access-links/${link.token}/complete`)
      .send({ password: 'Redefinida456' })
      .expect(200);

    await login(memberEmail, 'NovaSenha123').expect(401);
    await login(memberEmail, 'Redefinida456').expect(200);
    await api()
      .post('/api/auth/refresh')
      .send({ refreshToken: oldRefresh })
      .expect(401);
  });

  it('trocar a própria senha: confere a atual e derruba as outras sessões', async () => {
    const other = await login(memberEmail, 'Redefinida456').expect(200);
    const otherRefresh = (other.body as { refreshToken: string }).refreshToken;
    const token = await authAs(app, memberEmail, 'Redefinida456');
    const asMember = (r: request.Test) =>
      r.set('Authorization', `Bearer ${token}`);

    await asMember(api().post('/api/auth/change-password'))
      .send({ currentPassword: 'errada000', newPassword: 'TrocadaPor789' })
      .expect(400);

    const ok = await asMember(api().post('/api/auth/change-password'))
      .send({ currentPassword: 'Redefinida456', newPassword: 'TrocadaPor789' })
      .expect(200);
    expect(
      (ok.body as { otherSessionsRevoked: number }).otherSessionsRevoked,
    ).toBeGreaterThanOrEqual(1);

    await login(memberEmail, 'Redefinida456').expect(401);
    await login(memberEmail, 'TrocadaPor789').expect(200);
    await api()
      .post('/api/auth/refresh')
      .send({ refreshToken: otherRefresh })
      .expect(401);
    // A sessão deste aparelho continua valendo.
    await asMember(api().get('/api/auth/me')).expect(200);
  });

  it('quem já tem conta em outra loja confirma com a senha atual (o link não troca a senha)', async () => {
    const invite = await asOwner(api().post('/api/memberships'))
      .send({ email: existingEmail, role: 'AGENT' })
      .expect(201);
    const membershipId = (invite.body as { id: string }).id;

    const link = (await newLink(membershipId).expect(201)).body as LinkBody;
    const info = await api()
      .get(`/api/auth/access-links/${link.token}`)
      .expect(200);
    expect((info.body as { mode: string }).mode).toBe('CONFIRM_EXISTING');

    // Tentar definir senha nova sem saber a atual não funciona.
    await api()
      .post(`/api/auth/access-links/${link.token}/complete`)
      .send({ password: 'TomadaDeConta1' })
      .expect(401);
    await api()
      .post(`/api/auth/access-links/${link.token}/complete`)
      .send({ currentPassword: 'chuteErrado1' })
      .expect(401);
    await api()
      .post(`/api/auth/access-links/${link.token}/complete`)
      .send({ currentPassword: existingPassword })
      .expect(200);

    const res = await login(existingEmail, existingPassword).expect(200);
    const slugs = (
      res.body as { memberships: { companySlug: string }[] }
    ).memberships.map((m) => m.companySlug);
    expect(slugs).toEqual(
      expect.arrayContaining([E2E_COMPANY_SLUG, `outra-acesso-${suffix}`]),
    );

    // Ativa em duas lojas: uma loja não pode redefinir a senha usada na outra.
    const blocked = await newLink(membershipId).expect(409);
    expect((blocked.body as { code: string }).code).toBe(
      'USER_IN_OTHER_COMPANY',
    );
  });
});
