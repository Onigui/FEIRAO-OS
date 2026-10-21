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
