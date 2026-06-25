-- migrations/016_pix_flow.sql
-- INO RUN 2026 — Fluxo Pix com verificacao por IA (Gemini) + email (Resend)
-- Executar manualmente no Supabase SQL Editor

-- ══════════════════════════════════════════════════════════════
-- 1. TABELA pix_receipt (armazena analise do comprovante)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS pix_receipt (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id  uuid REFERENCES registration(id) ON DELETE CASCADE,
  storage_path     text,
  gemini_resultado text CHECK (gemini_resultado IN ('aprovado', 'reprovado')),
  gemini_motivo    text,
  gemini_raw       jsonb,
  created_at       timestamptz DEFAULT now()
);

-- RLS: apenas service_role acessa
ALTER TABLE pix_receipt ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON pix_receipt
  USING (auth.role() = 'service_role');

-- ══════════════════════════════════════════════════════════════
-- 2. FUNCAO confirmar_inscricao_pix
--    Chamada pela Edge Function com service_role apos Gemini aprovar
--    Gera bib_number sequencial e confirma o pagamento
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION confirmar_inscricao_pix(p_registration_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bib       int;
  v_event_id  uuid;
  v_status    text;
BEGIN
  SELECT status, event_id INTO v_status, v_event_id
    FROM registration WHERE id = p_registration_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Inscricao nao encontrada');
  END IF;

  -- Idempotencia: ja confirmada, retorna bib existente
  IF v_status = 'confirmado' THEN
    SELECT bib_number INTO v_bib FROM registration WHERE id = p_registration_id;
    RETURN jsonb_build_object('bib_number', v_bib, 'ja_confirmado', true);
  END IF;

  -- Gera bib sequencial por evento (apenas inscricoes confirmadas)
  SELECT COALESCE(MAX(bib_number), 0) + 1 INTO v_bib
    FROM registration
    WHERE event_id = v_event_id AND status = 'confirmado';

  -- Confirma a inscricao
  UPDATE registration
    SET status = 'confirmado', bib_number = v_bib
    WHERE id = p_registration_id;

  -- Confirma o pagamento
  UPDATE payment
    SET status = 'pago', paid_at = now()
    WHERE registration_id = p_registration_id AND status = 'criado';

  RETURN jsonb_build_object('bib_number', v_bib);
END;
$$;

-- Permissao apenas para service_role (Edge Function usa service_role key)
REVOKE ALL ON FUNCTION confirmar_inscricao_pix(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirmar_inscricao_pix(uuid) TO service_role;

-- ══════════════════════════════════════════════════════════════
-- 3. BUCKET comprovantes (executar no Supabase Storage, nao aqui)
-- ══════════════════════════════════════════════════════════════
-- Criar manualmente no Supabase Dashboard > Storage:
--   Nome: comprovantes
--   Visibilidade: PRIVATE
--   Max upload size: 5MB
--   Allowed types: image/jpeg, image/png, image/webp, application/pdf

-- ══════════════════════════════════════════════════════════════
-- VERIFICACAO
-- ══════════════════════════════════════════════════════════════
-- SELECT table_name FROM information_schema.tables WHERE table_name IN ('pix_receipt');
-- SELECT proname FROM pg_proc WHERE proname = 'confirmar_inscricao_pix';
