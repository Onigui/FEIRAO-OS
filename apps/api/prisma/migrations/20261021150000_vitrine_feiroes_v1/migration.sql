-- Vitrine e Feirões V1 — estoque, vitrine pública, feirões, interesses de lead + RLS
-- Design: docs/vitrine-feiroes-design.md

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VehicleTransmission" AS ENUM ('MANUAL', 'AUTOMATIC', 'CVT', 'AUTOMATED');

-- CreateEnum
CREATE TYPE "VehicleFuel" AS ENUM ('FLEX', 'GASOLINE', 'ETHANOL', 'DIESEL', 'HYBRID', 'ELECTRIC');

-- CreateEnum
CREATE TYPE "FairStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'LIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "FairParticipantStatus" AS ENUM ('INVITED', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "VehicleInterestIntent" AS ENUM ('INTEREST', 'PRICE_ALERT', 'VISIT_AT_FAIR');

-- CreateEnum
CREATE TYPE "ShowcaseAnalyticsType" AS ENUM ('PAGE_VIEW', 'QR_SCAN', 'WHATSAPP_CLICK', 'SEARCH');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "city" VARCHAR(120),
ADD COLUMN     "public_address" VARCHAR(300),
ADD COLUMN     "public_whatsapp" VARCHAR(32),
ADD COLUMN     "showcase_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showcase_terms_accepted_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "showcase_code" VARCHAR(16) NOT NULL,
    "make" VARCHAR(60) NOT NULL,
    "model" VARCHAR(80) NOT NULL,
    "version" VARCHAR(120),
    "year_manufacture" INTEGER NOT NULL,
    "year_model" INTEGER NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "mileage_km" INTEGER NOT NULL,
    "transmission" "VehicleTransmission" NOT NULL,
    "fuel" "VehicleFuel" NOT NULL,
    "body_type" VARCHAR(40),
    "color" VARCHAR(40),
    "description" TEXT,
    "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "sold_at" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_photos" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "storage_key" VARCHAR(300) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_status_transitions" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "from_status" "VehicleStatus" NOT NULL,
    "to_status" "VehicleStatus" NOT NULL,
    "actor_user_id" UUID,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_status_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fairs" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "venue" VARCHAR(200) NOT NULL,
    "address" VARCHAR(300),
    "description" TEXT,
    "cover_key" VARCHAR(300),
    "status" "FairStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "fairs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fair_participants" (
    "id" UUID NOT NULL,
    "fair_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "organizer_company_id" UUID NOT NULL,
    "status" "FairParticipantStatus" NOT NULL DEFAULT 'INVITED',
    "invited_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMPTZ(6),

    CONSTRAINT "fair_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fair_vehicles" (
    "id" UUID NOT NULL,
    "fair_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "organizer_company_id" UUID NOT NULL,
    "price_cents_at_fair" INTEGER NOT NULL,
    "qr_code" VARCHAR(16) NOT NULL,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fair_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_vehicle_interests" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "vehicle_id" UUID,
    "fair_id" UUID,
    "fair_organizer_company_id" UUID,
    "intent" "VehicleInterestIntent" NOT NULL,
    "source" VARCHAR(32) NOT NULL,
    "consent_contact_at" TIMESTAMPTZ(6) NOT NULL,
    "consent_marketing_at" TIMESTAMPTZ(6),
    "consent_text_version" VARCHAR(32) NOT NULL,
    "anonymized_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_vehicle_interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "showcase_analytics_events" (
    "id" UUID NOT NULL,
    "type" "ShowcaseAnalyticsType" NOT NULL,
    "company_id" UUID,
    "vehicle_id" UUID,
    "fair_id" UUID,
    "session_hash" VARCHAR(64) NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "showcase_analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_slug_key" ON "vehicles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_showcase_code_key" ON "vehicles"("showcase_code");

-- CreateIndex
CREATE INDEX "vehicles_company_id_status_idx" ON "vehicles"("company_id", "status");

-- CreateIndex
CREATE INDEX "vehicles_company_id_created_at_idx" ON "vehicles"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "vehicles_status_price_cents_idx" ON "vehicles"("status", "price_cents");

-- CreateIndex
CREATE INDEX "vehicle_photos_vehicle_id_sort_order_idx" ON "vehicle_photos"("vehicle_id", "sort_order");

-- CreateIndex
CREATE INDEX "vehicle_photos_company_id_idx" ON "vehicle_photos"("company_id");

-- CreateIndex
CREATE INDEX "vehicle_status_transitions_vehicle_id_occurred_at_idx" ON "vehicle_status_transitions"("vehicle_id", "occurred_at");

-- CreateIndex
CREATE INDEX "vehicle_status_transitions_company_id_occurred_at_idx" ON "vehicle_status_transitions"("company_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "fairs_slug_key" ON "fairs"("slug");

-- CreateIndex
CREATE INDEX "fairs_company_id_starts_at_idx" ON "fairs"("company_id", "starts_at");

-- CreateIndex
CREATE INDEX "fairs_status_starts_at_idx" ON "fairs"("status", "starts_at");

-- CreateIndex
CREATE INDEX "fair_participants_company_id_idx" ON "fair_participants"("company_id");

-- CreateIndex
CREATE INDEX "fair_participants_organizer_company_id_idx" ON "fair_participants"("organizer_company_id");

-- CreateIndex
CREATE UNIQUE INDEX "fair_participants_fair_id_company_id_key" ON "fair_participants"("fair_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "fair_vehicles_qr_code_key" ON "fair_vehicles"("qr_code");

-- CreateIndex
CREATE INDEX "fair_vehicles_company_id_idx" ON "fair_vehicles"("company_id");

-- CreateIndex
CREATE INDEX "fair_vehicles_organizer_company_id_idx" ON "fair_vehicles"("organizer_company_id");

-- CreateIndex
CREATE UNIQUE INDEX "fair_vehicles_fair_id_vehicle_id_key" ON "fair_vehicles"("fair_id", "vehicle_id");

-- CreateIndex
CREATE INDEX "lead_vehicle_interests_company_id_created_at_idx" ON "lead_vehicle_interests"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "lead_vehicle_interests_lead_id_idx" ON "lead_vehicle_interests"("lead_id");

-- CreateIndex
CREATE INDEX "lead_vehicle_interests_company_id_lead_id_vehicle_id_idx" ON "lead_vehicle_interests"("company_id", "lead_id", "vehicle_id");

-- CreateIndex
CREATE INDEX "lead_vehicle_interests_fair_organizer_company_id_fair_id_idx" ON "lead_vehicle_interests"("fair_organizer_company_id", "fair_id");

-- CreateIndex
CREATE INDEX "showcase_analytics_events_fair_id_type_occurred_at_idx" ON "showcase_analytics_events"("fair_id", "type", "occurred_at");

-- CreateIndex
CREATE INDEX "showcase_analytics_events_company_id_type_occurred_at_idx" ON "showcase_analytics_events"("company_id", "type", "occurred_at");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_status_transitions" ADD CONSTRAINT "vehicle_status_transitions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_status_transitions" ADD CONSTRAINT "vehicle_status_transitions_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fairs" ADD CONSTRAINT "fairs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fair_participants" ADD CONSTRAINT "fair_participants_fair_id_fkey" FOREIGN KEY ("fair_id") REFERENCES "fairs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fair_participants" ADD CONSTRAINT "fair_participants_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fair_vehicles" ADD CONSTRAINT "fair_vehicles_fair_id_fkey" FOREIGN KEY ("fair_id") REFERENCES "fairs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fair_vehicles" ADD CONSTRAINT "fair_vehicles_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fair_vehicles" ADD CONSTRAINT "fair_vehicles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_vehicle_interests" ADD CONSTRAINT "lead_vehicle_interests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_vehicle_interests" ADD CONSTRAINT "lead_vehicle_interests_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_vehicle_interests" ADD CONSTRAINT "lead_vehicle_interests_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_vehicle_interests" ADD CONSTRAINT "lead_vehicle_interests_fair_id_fkey" FOREIGN KEY ("fair_id") REFERENCES "fairs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ===== RLS — Vitrine e Feirões =====
-- Acrescentar AO FINAL da migration gerada pelo Prisma (mesmo padrão de 20260804180000_rls_tenant_policies).
-- Usa as funções existentes autopilot_rls_company_id() e autopilot_rls_bypass().

-- Nova flag de sessão: leitura pública controlada (ligada só pelo módulo showcase).
CREATE OR REPLACE FUNCTION autopilot_rls_public_read()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(current_setting('app.public_read', true), 'off') = 'on';
$$;

-- vehicles: tenant; leitura pública do que está publicado; organizador lê carros inscritos no seu feirão.
ALTER TABLE "vehicles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehicles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "vehicles"
  FOR ALL
  USING (autopilot_rls_bypass() OR company_id = autopilot_rls_company_id())
  WITH CHECK (autopilot_rls_bypass() OR company_id = autopilot_rls_company_id());
CREATE POLICY public_read ON "vehicles"
  FOR SELECT
  USING (
    autopilot_rls_public_read()
    AND deleted_at IS NULL
    AND status <> 'ARCHIVED'
    AND EXISTS (SELECT 1 FROM companies c WHERE c.id = vehicles.company_id AND c.showcase_enabled AND c.status = 'ACTIVE')
  );
CREATE POLICY fair_organizer_read ON "vehicles"
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM fair_vehicles fv
    WHERE fv.vehicle_id = vehicles.id AND fv.organizer_company_id = autopilot_rls_company_id()
  ));

-- vehicle_photos: tenant; leitura pública quando o veículo é público.
ALTER TABLE "vehicle_photos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehicle_photos" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "vehicle_photos"
  FOR ALL
  USING (autopilot_rls_bypass() OR company_id = autopilot_rls_company_id())
  WITH CHECK (autopilot_rls_bypass() OR company_id = autopilot_rls_company_id());
CREATE POLICY public_read ON "vehicle_photos"
  FOR SELECT
  USING (autopilot_rls_public_read() AND EXISTS (SELECT 1 FROM vehicles v WHERE v.id = vehicle_photos.vehicle_id));

-- vehicle_status_transitions: tenant estrito.
ALTER TABLE "vehicle_status_transitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehicle_status_transitions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "vehicle_status_transitions"
  FOR ALL
  USING (autopilot_rls_bypass() OR company_id = autopilot_rls_company_id())
  WITH CHECK (autopilot_rls_bypass() OR company_id = autopilot_rls_company_id());

-- Trava colunas de vínculo depois de criadas (ninguém troca feirão, loja ou organizador de uma linha).
CREATE OR REPLACE FUNCTION autopilot_fair_link_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.fair_id IS DISTINCT FROM OLD.fair_id
     OR NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.organizer_company_id IS DISTINCT FROM OLD.organizer_company_id THEN
    RAISE EXCEPTION 'fair link columns are immutable';
  END IF;
  RETURN NEW;
END;
$$;

-- fair_participants: organizador convida (e o organizador gravado precisa ser o dono do feirão);
-- convidada e organizador leem e atualizam; só o organizador remove.
ALTER TABLE "fair_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fair_participants" FORCE ROW LEVEL SECURITY;
CREATE POLICY fp_select ON "fair_participants" FOR SELECT
  USING (autopilot_rls_bypass() OR company_id = autopilot_rls_company_id() OR organizer_company_id = autopilot_rls_company_id()
         OR (autopilot_rls_public_read() AND status = 'ACCEPTED'));
CREATE POLICY fp_insert ON "fair_participants" FOR INSERT
  WITH CHECK (autopilot_rls_bypass() OR (
    organizer_company_id = autopilot_rls_company_id()
    AND organizer_company_id = (SELECT f.company_id FROM fairs f WHERE f.id = fair_id)
  ));
CREATE POLICY fp_update ON "fair_participants" FOR UPDATE
  USING (autopilot_rls_bypass() OR company_id = autopilot_rls_company_id() OR organizer_company_id = autopilot_rls_company_id())
  WITH CHECK (autopilot_rls_bypass() OR company_id = autopilot_rls_company_id() OR organizer_company_id = autopilot_rls_company_id());
CREATE POLICY fp_delete ON "fair_participants" FOR DELETE
  USING (autopilot_rls_bypass() OR organizer_company_id = autopilot_rls_company_id());
CREATE TRIGGER fair_participants_link_immutable BEFORE UPDATE ON "fair_participants"
  FOR EACH ROW EXECUTE FUNCTION autopilot_fair_link_immutable();

-- fairs: organizador escreve; participantes leem; público lê fora de rascunho.
ALTER TABLE "fairs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fairs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "fairs"
  FOR ALL
  USING (autopilot_rls_bypass() OR company_id = autopilot_rls_company_id())
  WITH CHECK (autopilot_rls_bypass() OR company_id = autopilot_rls_company_id());
CREATE POLICY participant_read ON "fairs"
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM fair_participants fp
    WHERE fp.fair_id = fairs.id AND fp.company_id = autopilot_rls_company_id()
  ));
CREATE POLICY public_read ON "fairs"
  FOR SELECT
  USING (autopilot_rls_public_read() AND deleted_at IS NULL AND status <> 'DRAFT');

-- fair_vehicles: só loja que ACEITOU o convite inscreve carro PRÓPRIO; organizador e público leem.
ALTER TABLE "fair_vehicles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fair_vehicles" FORCE ROW LEVEL SECURITY;
CREATE POLICY fv_select ON "fair_vehicles" FOR SELECT
  USING (autopilot_rls_bypass() OR company_id = autopilot_rls_company_id() OR organizer_company_id = autopilot_rls_company_id()
         OR autopilot_rls_public_read());
CREATE POLICY fv_insert ON "fair_vehicles" FOR INSERT
  WITH CHECK (autopilot_rls_bypass() OR (
    company_id = autopilot_rls_company_id()
    AND EXISTS (SELECT 1 FROM vehicles v WHERE v.id = vehicle_id AND v.company_id = autopilot_rls_company_id())
    AND EXISTS (SELECT 1 FROM fair_participants fp
                WHERE fp.fair_id = fair_vehicles.fair_id AND fp.company_id = autopilot_rls_company_id()
                  AND fp.status = 'ACCEPTED' AND fp.organizer_company_id = fair_vehicles.organizer_company_id)
  ));
CREATE POLICY fv_update ON "fair_vehicles" FOR UPDATE
  USING (autopilot_rls_bypass() OR company_id = autopilot_rls_company_id())
  WITH CHECK (autopilot_rls_bypass() OR company_id = autopilot_rls_company_id());
CREATE POLICY fv_delete ON "fair_vehicles" FOR DELETE
  USING (autopilot_rls_bypass() OR company_id = autopilot_rls_company_id());
CREATE TRIGGER fair_vehicles_link_immutable BEFORE UPDATE ON "fair_vehicles"
  FOR EACH ROW EXECUTE FUNCTION autopilot_fair_link_immutable();

-- lead_vehicle_interests: tenant estrito; o organizador gravado precisa ser o dono do feirão;
-- organizador só LÊ as linhas do seu feirão (a linha não tem nome nem telefone).
ALTER TABLE "lead_vehicle_interests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lead_vehicle_interests" FORCE ROW LEVEL SECURITY;
CREATE POLICY lvi_select ON "lead_vehicle_interests" FOR SELECT
  USING (autopilot_rls_bypass() OR company_id = autopilot_rls_company_id() OR fair_organizer_company_id = autopilot_rls_company_id());
CREATE POLICY lvi_insert ON "lead_vehicle_interests" FOR INSERT
  WITH CHECK (autopilot_rls_bypass() OR (
    company_id = autopilot_rls_company_id()
    AND (
      (fair_id IS NULL AND fair_organizer_company_id IS NULL)
      OR fair_organizer_company_id = (SELECT f.company_id FROM fairs f WHERE f.id = fair_id)
    )
  ));
CREATE POLICY lvi_update ON "lead_vehicle_interests" FOR UPDATE
  USING (autopilot_rls_bypass() OR company_id = autopilot_rls_company_id())
  WITH CHECK (autopilot_rls_bypass() OR company_id = autopilot_rls_company_id());
CREATE POLICY lvi_delete ON "lead_vehicle_interests" FOR DELETE
  USING (autopilot_rls_bypass() OR company_id = autopilot_rls_company_id());

-- showcase_analytics_events: sem dado pessoal; inserção pública; leitura só pelo serviço filtrado por loja.
-- (sem RLS, documentado como exceção no design)
