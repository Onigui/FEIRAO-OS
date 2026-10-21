import { getTenantCompanyId } from '../core/tenancy/tenant-als';
import { isRlsBypass, isRlsPublicRead } from './rls-context';

type RawTx = {
  $executeRaw: (
    ...args: [TemplateStringsArray, ...unknown[]]
  ) => Promise<unknown>;
};

/**
 * SET LOCAL app.company_id / app.rls_bypass / app.public_read on the current transaction connection.
 * public_read shares the first statement with rls_bypass (keeps 2 round-trips per transaction).
 */
export async function applyRlsSessionGuc(tx: RawTx): Promise<void> {
  if (isRlsBypass()) {
    await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'on', true), set_config('app.public_read', 'off', true)`;
    await tx.$executeRaw`SELECT set_config('app.company_id', '', true)`;
    return;
  }

  const companyId = getTenantCompanyId();
  const publicRead = isRlsPublicRead() ? 'on' : 'off';
  await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'off', true), set_config('app.public_read', ${publicRead}, true)`;
  if (companyId) {
    await tx.$executeRaw`SELECT set_config('app.company_id', ${companyId}, true)`;
  } else {
    await tx.$executeRaw`SELECT set_config('app.company_id', '', true)`;
  }
}
