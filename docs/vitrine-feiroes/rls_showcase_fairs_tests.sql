-- rls_showcase_fairs_tests.sql — 26 cenários de RLS (Vitrine e Feirões)
-- Rodado em 21/10/2026 num PostgreSQL 16 com as 21 migrations do AutoPilot + tabelas novas + rls_showcase_fairs.sql.
-- Rodar como o usuário dono das tabelas (sem superuser), com psql -f.
-- ATENÇÃO: o seed abaixo usa só as colunas necessárias ao teste. Ao transformar em teste automatizado
-- (etapa 1), preencha também as colunas obrigatórias do schema real (ex.: fairs.starts_at/ends_at/venue,
-- vehicles.model/year_*/mileage_km/transmission/fuel/showcase_code).
\set ON_ERROR_STOP 0
\pset tuples_only on
-- Seed com bypass
BEGIN;
SELECT set_config('app.rls_bypass','on',true);
INSERT INTO companies (id,name,updated_at,showcase_enabled) VALUES
 ('aaaaaaaa-0000-0000-0000-000000000001','Loja A (organizadora)',now(),true),
 ('bbbbbbbb-0000-0000-0000-000000000002','Loja B (convidada)',now(),true),
 ('cccccccc-0000-0000-0000-000000000003','Loja C (fora)',now(),false);
INSERT INTO vehicles (id,company_id,slug,make,status,price_cents) VALUES
 ('a1000000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','a1','Fiat','AVAILABLE',5000000),
 ('b1000000-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','b1','VW','AVAILABLE',6000000),
 ('b2000000-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000002','b2','VW','ARCHIVED',7000000),
 ('c1000000-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000003','c1','GM','AVAILABLE',8000000);
INSERT INTO fairs (id,company_id,name,slug,status) VALUES ('f0000000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Feirão','feirao-dez','DRAFT');
INSERT INTO fair_participants (id,fair_id,company_id,organizer_company_id,status) VALUES
 ('d0000000-0000-0000-0000-00000000000a','f0000000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','ACCEPTED');
COMMIT;
-- helper macro: each block = own transaction with tenant/public flags
\echo T01 B ve so os proprios carros (esperado 2)
BEGIN; SELECT set_config('app.company_id','bbbbbbbb-0000-0000-0000-000000000002',true); SELECT count(*) FROM vehicles; ROLLBACK;
\echo T02 B tenta alterar carro de A (esperado UPDATE 0)
BEGIN; SELECT set_config('app.company_id','bbbbbbbb-0000-0000-0000-000000000002',true); UPDATE vehicles SET price_cents=1 WHERE id='a1000000-0000-0000-0000-000000000001'; ROLLBACK;
\echo T03 B tenta criar carro em nome de A (esperado ERRO)
BEGIN; SELECT set_config('app.company_id','bbbbbbbb-0000-0000-0000-000000000002',true); INSERT INTO vehicles (id,company_id,slug,make,price_cents) VALUES (gen_random_uuid(),'aaaaaaaa-0000-0000-0000-000000000001','x','X',1); ROLLBACK;
\echo T04 publico ve carros publicados de lojas com vitrine (esperado 2: a1,b1)
BEGIN; SELECT set_config('app.public_read','on',true); SELECT string_agg(slug,',' ORDER BY slug) FROM vehicles; ROLLBACK;
\echo T05 publico nao ve feirao em rascunho (esperado 0)
BEGIN; SELECT set_config('app.public_read','on',true); SELECT count(*) FROM fairs; ROLLBACK;
\echo T06 publico sem flag nem tenant ve nada (esperado 0)
BEGIN; SELECT count(*) FROM vehicles; ROLLBACK;
\echo T07 A convida B (esperado INSERT ok)
BEGIN; SELECT set_config('app.company_id','aaaaaaaa-0000-0000-0000-000000000001',true); INSERT INTO fair_participants (id,fair_id,company_id,organizer_company_id) VALUES ('d0000000-0000-0000-0000-00000000000b','f0000000-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001'); COMMIT;
\echo T08 C tenta se inscrever sozinha no feirao de A (esperado ERRO)
BEGIN; SELECT set_config('app.company_id','cccccccc-0000-0000-0000-000000000003',true); INSERT INTO fair_participants (id,fair_id,company_id,organizer_company_id) VALUES (gen_random_uuid(),'f0000000-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001'); ROLLBACK;
\echo T09 C tenta se inscrever dizendo ser organizadora (esperado ERRO)
BEGIN; SELECT set_config('app.company_id','cccccccc-0000-0000-0000-000000000003',true); INSERT INTO fair_participants (id,fair_id,company_id,organizer_company_id) VALUES (gen_random_uuid(),'f0000000-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000003','cccccccc-0000-0000-0000-000000000003'); ROLLBACK;
\echo T10 B (convidada) ve o feirao em rascunho (esperado 1)
BEGIN; SELECT set_config('app.company_id','bbbbbbbb-0000-0000-0000-000000000002',true); SELECT count(*) FROM fairs; ROLLBACK;
\echo T11 C nao ve feirao nem participantes (esperado 0 e 0)
BEGIN; SELECT set_config('app.company_id','cccccccc-0000-0000-0000-000000000003',true); SELECT count(*) FROM fairs; SELECT count(*) FROM fair_participants; ROLLBACK;
\echo T12 B ainda INVITED tenta inscrever carro (esperado ERRO)
BEGIN; SELECT set_config('app.company_id','bbbbbbbb-0000-0000-0000-000000000002',true); INSERT INTO fair_vehicles (id,fair_id,vehicle_id,company_id,organizer_company_id,qr_code) VALUES (gen_random_uuid(),'f0000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','QR1'); ROLLBACK;
\echo T13 B aceita o convite (esperado UPDATE 1)
BEGIN; SELECT set_config('app.company_id','bbbbbbbb-0000-0000-0000-000000000002',true); UPDATE fair_participants SET status='ACCEPTED' WHERE company_id='bbbbbbbb-0000-0000-0000-000000000002'; COMMIT;
\echo T14 B inscreve carro proprio (esperado INSERT ok)
BEGIN; SELECT set_config('app.company_id','bbbbbbbb-0000-0000-0000-000000000002',true); INSERT INTO fair_vehicles (id,fair_id,vehicle_id,company_id,organizer_company_id,qr_code) VALUES ('e0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','QR1'); COMMIT;
\echo T15 B tenta inscrever carro de A (esperado ERRO)
BEGIN; SELECT set_config('app.company_id','bbbbbbbb-0000-0000-0000-000000000002',true); INSERT INTO fair_vehicles (id,fair_id,vehicle_id,company_id,organizer_company_id,qr_code) VALUES (gen_random_uuid(),'f0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','QR2'); ROLLBACK;
\echo T16 A (organizadora) ve a1 e o b1 inscrito, mas nao o b2 (esperado a1,b1)
BEGIN; SELECT set_config('app.company_id','aaaaaaaa-0000-0000-0000-000000000001',true); SELECT string_agg(slug,',' ORDER BY slug) FROM vehicles; ROLLBACK;
\echo T17 A tenta alterar carro de B (esperado UPDATE 0)
BEGIN; SELECT set_config('app.company_id','aaaaaaaa-0000-0000-0000-000000000001',true); UPDATE vehicles SET price_cents=1 WHERE id='b1000000-0000-0000-0000-000000000001'; ROLLBACK;
\echo T18 A tenta trocar o organizador de uma participacao (esperado ERRO)
BEGIN; SELECT set_config('app.company_id','aaaaaaaa-0000-0000-0000-000000000001',true); UPDATE fair_participants SET organizer_company_id='cccccccc-0000-0000-0000-000000000003' WHERE company_id='bbbbbbbb-0000-0000-0000-000000000002'; ROLLBACK;
\echo T19 B cria lead e interesse ligado ao feirao de A (esperado ok)
BEGIN; SELECT set_config('app.company_id','bbbbbbbb-0000-0000-0000-000000000002',true);
INSERT INTO leads (id,company_id,name,phone,updated_at) VALUES ('11111111-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','Visitante','+5514999990000',now());
INSERT INTO lead_vehicle_interests (id,company_id,lead_id,vehicle_id,fair_id,fair_organizer_company_id) VALUES (gen_random_uuid(),'bbbbbbbb-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001'); COMMIT;
\echo T20 B tenta gravar interesse com organizador falso C (esperado ERRO)
BEGIN; SELECT set_config('app.company_id','bbbbbbbb-0000-0000-0000-000000000002',true); INSERT INTO lead_vehicle_interests (id,company_id,lead_id,fair_id,fair_organizer_company_id) VALUES (gen_random_uuid(),'bbbbbbbb-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000003'); ROLLBACK;
\echo T21 A conta 1 interesse do feirao mas nao le o lead de B (esperado 1 e 0)
BEGIN; SELECT set_config('app.company_id','aaaaaaaa-0000-0000-0000-000000000001',true); SELECT count(*) FROM lead_vehicle_interests; SELECT count(*) FROM leads; ROLLBACK;
\echo T22 C nao ve interesses nem leads (esperado 0 e 0)
BEGIN; SELECT set_config('app.company_id','cccccccc-0000-0000-0000-000000000003',true); SELECT count(*) FROM lead_vehicle_interests; SELECT count(*) FROM leads; ROLLBACK;
\echo T23 publico com feirao publicado: ve feirao, participantes aceitos e carros inscritos (esperado 1,2,1)
BEGIN; SELECT set_config('app.rls_bypass','on',true); UPDATE fairs SET status='PUBLISHED'; COMMIT;
BEGIN; SELECT set_config('app.public_read','on',true); SELECT count(*) FROM fairs; SELECT count(*) FROM fair_participants; SELECT count(*) FROM fair_vehicles; ROLLBACK;
\echo T24 publico nao ve interesses nem leads (esperado 0 e 0)
BEGIN; SELECT set_config('app.public_read','on',true); SELECT count(*) FROM lead_vehicle_interests; SELECT count(*) FROM leads; ROLLBACK;
\echo T25 B tenta se auto-convidar para outro feirao de A criando a linha (esperado ERRO)
BEGIN; SELECT set_config('app.rls_bypass','on',true); INSERT INTO fairs (id,company_id,name,slug) VALUES ('f0000000-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','Outro','outro'); COMMIT;
BEGIN; SELECT set_config('app.company_id','bbbbbbbb-0000-0000-0000-000000000002',true); INSERT INTO fair_participants (id,fair_id,company_id,organizer_company_id,status) VALUES (gen_random_uuid(),'f0000000-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','ACCEPTED'); ROLLBACK;

\echo T26 organizador tenta remover carro inscrito por B (esperado DELETE 0)
BEGIN; SELECT set_config('app.company_id','aaaaaaaa-0000-0000-0000-000000000001',true); WITH d AS (DELETE FROM fair_vehicles RETURNING 1) SELECT count(*) FROM d; ROLLBACK;
