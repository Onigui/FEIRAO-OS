import { assertAppDbRoleRespectsRls } from './db-role-guard';

const client = (row: { name: string; bypass: boolean; superuser: boolean } | undefined) => ({
  $queryRaw: jest.fn().mockResolvedValue(row ? [row] : []),
});
const logger = { warn: jest.fn() } as never;

describe('assertAppDbRoleRespectsRls', () => {
  it('papel da aplicação sem bypass: segue', async () => {
    await expect(
      assertAppDbRoleRespectsRls(client({ name: 'autopilot_app', bypass: false, superuser: false }), { nodeEnv: 'production', allowBypass: false }, logger),
    ).resolves.toBeUndefined();
  });

  it('produção com papel que ignora RLS: recusa subir', async () => {
    await expect(
      assertAppDbRoleRespectsRls(client({ name: 'neondb_owner', bypass: true, superuser: false }), { nodeEnv: 'production', allowBypass: false }, logger),
    ).rejects.toThrow('ignora RLS');
  });

  it('produção com liberação explícita, ou fora de produção: só avisa', async () => {
    await expect(
      assertAppDbRoleRespectsRls(client({ name: 'postgres', bypass: true, superuser: true }), { nodeEnv: 'production', allowBypass: true }, logger),
    ).resolves.toBeUndefined();
    await expect(
      assertAppDbRoleRespectsRls(client({ name: 'postgres', bypass: false, superuser: true }), { nodeEnv: 'test', allowBypass: false }, logger),
    ).resolves.toBeUndefined();
  });
});
