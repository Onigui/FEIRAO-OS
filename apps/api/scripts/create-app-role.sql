-- Vitrine e Feirões / AutoPilot — papel da aplicação SEM BYPASSRLS.
-- Rodar como dono do banco (o mesmo usuário das migrations), uma vez por banco:
--   psql "$MIGRATION_DATABASE_URL" -v app_password="'<senha forte>'" -f scripts/create-app-role.sql
-- Depois, a API usa DATABASE_URL com o usuário autopilot_app.
-- Idempotente: pode rodar de novo (atualiza a senha e as permissões).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'autopilot_app') THEN
    CREATE ROLE autopilot_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

-- Só senha e login: no Neon o dono não é superusuário e não pode mexer nos atributos
-- SUPERUSER/BYPASSRLS (o papel já nasce sem eles no CREATE acima; a API confere ao subir).
ALTER ROLE autopilot_app WITH LOGIN PASSWORD :app_password;

SELECT format('GRANT CONNECT ON DATABASE %I TO autopilot_app', current_database()) \gexec

GRANT USAGE ON SCHEMA public TO autopilot_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO autopilot_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO autopilot_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO autopilot_app;

-- Tabelas criadas por migrations futuras (rodadas pelo dono) também ficam acessíveis.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO autopilot_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO autopilot_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO autopilot_app;

-- A aplicação nunca mexe no histórico de migrations.
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    REVOKE ALL ON TABLE public._prisma_migrations FROM autopilot_app;
  END IF;
END $$;

SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'autopilot_app';
