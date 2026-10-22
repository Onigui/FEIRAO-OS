import { MembershipRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { AccessLinksService, hashAccessToken } from './access-links.service';
import { assertPasswordPolicy } from './password-policy';

const COMPANY = '11111111-1111-1111-1111-111111111111';
const OWNER_ID = '22222222-2222-2222-2222-222222222222';
const MEMBER_ID = '33333333-3333-3333-3333-333333333333';

function actor(role: MembershipRole = MembershipRole.OWNER) {
  return { sub: OWNER_ID, sid: 's1', cid: COMPANY, mid: 'm0', role };
}

function setup(
  over: {
    membership?: Record<string, unknown> | null;
    link?: Record<string, unknown> | null;
    elsewhere?: number;
    claimed?: number;
  } = {},
) {
  const membership =
    over.membership === undefined
      ? {
          id: 'm1',
          userId: MEMBER_ID,
          companyId: COMPANY,
          role: MembershipRole.AGENT,
          status: 'INVITED',
          user: {
            id: MEMBER_ID,
            email: 'vendedor@loja.dev',
            name: 'Vendedor',
            passwordHash: null,
            deletedAt: null,
          },
        }
      : over.membership;

  const tx = {
    accessLink: {
      updateMany: jest.fn().mockResolvedValue({ count: over.claimed ?? 1 }),
      create: jest.fn().mockResolvedValue({ id: 'link1' }),
    },
    user: { update: jest.fn().mockResolvedValue({}) },
    membership: { update: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    membership: {
      findFirst: jest.fn().mockResolvedValue(membership),
      count: jest.fn().mockResolvedValue(over.elsewhere ?? 0),
    },
    accessLink: {
      findUnique: jest.fn().mockResolvedValue(over.link ?? null),
    },
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const audit = { write: jest.fn().mockResolvedValue({ id: 'a1' }) };
  const revocation = {
    logoutAllDevices: jest.fn().mockResolvedValue({ revokedSessions: 2 }),
    invalidateAccessCacheForUser: jest.fn().mockResolvedValue(undefined),
  };
  const service = new AccessLinksService(
    prisma as never,
    audit as never,
    revocation as never,
  );
  return { service, prisma, tx, audit, revocation };
}

function usableLink(over: Record<string, unknown> = {}) {
  return {
    id: 'link1',
    userId: MEMBER_ID,
    companyId: COMPANY,
    membershipId: 'm1',
    purpose: 'INVITE',
    usedAt: null,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    user: {
      id: MEMBER_ID,
      email: 'vendedor@loja.dev',
      name: 'Vendedor',
      passwordHash: null,
      deletedAt: null,
    },
    company: { id: COMPANY, name: 'Loja X', status: 'ACTIVE', deletedAt: null },
    membership: { id: 'm1', status: 'INVITED', deletedAt: null },
    ...over,
  };
}

const TOKEN = 'x'.repeat(43);

describe('AccessLinksService', () => {
  it('convite: guarda só o hash, cancela links anteriores e devolve o token', async () => {
    const { service, tx, audit } = setup();
    const res = await service.createForMembership(actor(), 'm1');

    expect(res.purpose).toBe('INVITE');
    expect(res.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tx.accessLink.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { membershipId: 'm1', usedAt: null, revokedAt: null },
      }),
    );
    const data = tx.accessLink.create.mock.calls[0][0].data;
    expect(data.tokenHash).toBe(hashAccessToken(res.token));
    expect(JSON.stringify(data)).not.toContain(res.token);
    expect(JSON.stringify(audit.write.mock.calls)).not.toContain(res.token);
  });

  it('não gera para si mesmo nem gerente para dono', async () => {
    const self = setup({
      membership: {
        id: 'm0',
        userId: OWNER_ID,
        role: MembershipRole.OWNER,
        status: 'ACTIVE',
        user: {
          id: OWNER_ID,
          email: 'o@x.dev',
          name: 'O',
          passwordHash: 'h',
          deletedAt: null,
        },
      },
    });
    await expect(
      self.service.createForMembership(actor(), 'm0'),
    ).rejects.toMatchObject({
      response: { code: 'USE_CHANGE_PASSWORD' },
    });

    const owner = setup({
      membership: {
        id: 'm2',
        userId: MEMBER_ID,
        role: MembershipRole.OWNER,
        status: 'ACTIVE',
        user: {
          id: MEMBER_ID,
          email: 'd@x.dev',
          name: 'D',
          passwordHash: 'h',
          deletedAt: null,
        },
      },
    });
    await expect(
      owner.service.createForMembership(actor(MembershipRole.ADMIN), 'm2'),
    ).rejects.toMatchObject({ response: { code: 'OWNER_ONLY' } });
  });

  it('não redefine senha de quem está ativo em outra loja', async () => {
    const { service } = setup({
      membership: {
        id: 'm1',
        userId: MEMBER_ID,
        role: MembershipRole.AGENT,
        status: 'ACTIVE',
        user: {
          id: MEMBER_ID,
          email: 'v@x.dev',
          name: 'V',
          passwordHash: 'h',
          deletedAt: null,
        },
      },
      elsewhere: 1,
    });
    await expect(
      service.createForMembership(actor(), 'm1'),
    ).rejects.toMatchObject({
      response: { code: 'USER_IN_OTHER_COMPANY' },
    });
  });

  it.each([
    ['usado', { usedAt: new Date() }],
    ['cancelado', { revokedAt: new Date() }],
    ['vencido', { expiresAt: new Date(Date.now() - 1) }],
    [
      'membro removido',
      { membership: { id: 'm1', status: 'REVOKED', deletedAt: null } },
    ],
    [
      'loja suspensa',
      {
        company: {
          id: COMPANY,
          name: 'X',
          status: 'SUSPENDED',
          deletedAt: null,
        },
      },
    ],
  ])('link %s não vale', async (_label, over) => {
    const { service } = setup({ link: usableLink(over) });
    await expect(service.describe(TOKEN)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('convite sem senha: define a senha, ativa o vínculo e não derruba sessões', async () => {
    const { service, tx, revocation } = setup({ link: usableLink() });
    await service.complete(TOKEN, { password: 'NovaSenha123' });

    const userData = tx.user.update.mock.calls[0][0].data;
    expect(await argon2.verify(userData.passwordHash, 'NovaSenha123')).toBe(
      true,
    );
    expect(userData.status).toBe('ACTIVE');
    expect(tx.membership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
    expect(revocation.logoutAllDevices).not.toHaveBeenCalled();
  });

  it('convite de quem já tem conta exige a senha atual e não troca a senha', async () => {
    const hash = await argon2.hash('SenhaAntiga1');
    const link = usableLink({
      user: {
        id: MEMBER_ID,
        email: 'v@x.dev',
        name: 'V',
        passwordHash: hash,
        deletedAt: null,
      },
    });
    const bad = setup({ link });
    await expect(
      bad.service.complete(TOKEN, { password: 'Tomada12345' }),
    ).rejects.toMatchObject({
      status: 401,
    });
    expect(bad.tx.user.update).not.toHaveBeenCalled();

    const ok = setup({ link });
    await ok.service.complete(TOKEN, { currentPassword: 'SenhaAntiga1' });
    expect(ok.tx.user.update).not.toHaveBeenCalled();
    expect(ok.tx.membership.update).toHaveBeenCalled();
  });

  it('redefinição troca a senha e encerra todas as sessões', async () => {
    const { service, tx, revocation } = setup({
      link: usableLink({
        purpose: 'PASSWORD_RESET',
        membership: { id: 'm1', status: 'ACTIVE', deletedAt: null },
      }),
    });
    await service.complete(TOKEN, { password: 'Redefinida1' });
    expect(tx.user.update).toHaveBeenCalled();
    expect(tx.membership.update).not.toHaveBeenCalled();
    expect(revocation.logoutAllDevices).toHaveBeenCalledWith(MEMBER_ID);
  });

  it('dois envios ao mesmo tempo: só o primeiro passa', async () => {
    const { service, tx } = setup({ link: usableLink(), claimed: 0 });
    await expect(
      service.complete(TOKEN, { password: 'NovaSenha123' }),
    ).rejects.toMatchObject({
      status: 404,
    });
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});

describe('assertPasswordPolicy', () => {
  it.each(['curta1', 'somenteletras', '1234567890', 'v@x.dev1'])(
    'recusa %s',
    (pw) => {
      const email = pw === 'v@x.dev1' ? 'V@x.dev1' : 'v@x.dev';
      expect(() => assertPasswordPolicy(pw, email)).toThrow();
    },
  );

  it('aceita letras + números com 8 ou mais', () => {
    expect(() => assertPasswordPolicy('Feirao2026', 'v@x.dev')).not.toThrow();
  });
});
