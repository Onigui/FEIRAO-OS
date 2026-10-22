import { Logger } from '@nestjs/common';

type RawClient = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

/**
 * O RLS só protege se o usuário do banco da aplicação NÃO for superusuário nem
 * tiver BYPASSRLS (o dono padrão do Neon tem). Em produção, recusa subir com um
 * usuário assim, a menos que DB_ALLOW_BYPASS_ROLE=true.
 * Use o papel criado por scripts/create-app-role.sql.
 */
export async function assertAppDbRoleRespectsRls(
  prisma: RawClient,
  env: { nodeEnv: string; allowBypass: boolean },
  logger = new Logger('DbRoleGuard'),
): Promise<void> {
  const rows = await prisma.$queryRaw<{ name: string; bypass: boolean; superuser: boolean }[]>`
    SELECT current_user AS name, rolbypassrls AS bypass, rolsuper AS superuser
    FROM pg_roles WHERE rolname = current_user`;
  const role = rows[0];
  if (!role || (!role.bypass && !role.superuser)) return;

  const message = `Usuário do banco "${role.name}" ignora RLS (superuser=${role.superuser}, bypassrls=${role.bypass}). Use o papel da aplicação (scripts/create-app-role.sql).`;
  if (env.nodeEnv === 'production' && !env.allowBypass) {
    throw new Error(message);
  }
  logger.warn(message);
}
