-- migrations/001_handshake_test.sql
-- Phase 2 · Link — tabela de teste de conectividade
-- Executada automaticamente por: npm run migrate

CREATE TABLE IF NOT EXISTS handshake_test (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem   text,
  criado_em  timestamptz DEFAULT now()
);

ALTER TABLE handshake_test ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "handshake_dev_all" ON handshake_test;
CREATE POLICY "handshake_dev_all" ON handshake_test
  FOR ALL TO anon USING (true) WITH CHECK (true);
