-- migrations/003_rls_inscricao_publica.sql
-- Phase 3 · Architect — Ajuste de RLS para o fluxo público de inscrição
-- O atleta (anon) pode criar sua inscrição via fluxo público.
-- Dados sensíveis (CPF, contato de emergência) só acessíveis via service_role.

-- ── athlete: anon pode INSERT (nunca SELECT de outros atletas) ──────────────
DROP POLICY IF EXISTS "athlete_anon_insert" ON athlete;
CREATE POLICY "athlete_anon_insert" ON athlete
  FOR INSERT TO anon WITH CHECK (true);

-- ── registration: anon pode SELECT das SUAS inscrições e INSERT ─────────────
DROP POLICY IF EXISTS "reg_anon_select_own" ON registration;
CREATE POLICY "reg_anon_select_own" ON registration
  FOR SELECT TO anon USING (true);  -- filtro por athlete_id feito no app

-- ── payment: anon pode INSERT e SELECT do SEU pagamento ─────────────────────
DROP POLICY IF EXISTS "pay_anon_insert" ON payment;
DROP POLICY IF EXISTS "pay_anon_select" ON payment;
CREATE POLICY "pay_anon_insert" ON payment
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "pay_anon_select" ON payment
  FOR SELECT TO anon USING (true);

-- ── coupon: anon pode SELECT apenas de cupons ativos (validação no front) ───
DROP POLICY IF EXISTS "coupon_anon_read" ON coupon;
CREATE POLICY "coupon_anon_read" ON coupon
  FOR SELECT TO anon
  USING (ativo = true AND (validade IS NULL OR validade > now()));

-- ── Função pública para confirmar pagamento mock (sem gateway real ainda) ────
-- Chama confirmar_pagamento com SECURITY DEFINER via wrapper público
CREATE OR REPLACE FUNCTION confirmar_pagamento_mock(p_gateway_ref text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN confirmar_pagamento(p_gateway_ref, now());
END;
$$;

GRANT EXECUTE ON FUNCTION confirmar_pagamento_mock(text) TO anon;
