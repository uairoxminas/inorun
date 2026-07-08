-- migrations/036_confirmar_manual_marca_pago.sql
-- INO RUN 2026 — A confirmação MANUAL de inscrição passa a marcar o pagamento
-- como 'pago', disparando o lançamento automático no financeiro (receita + taxa).
-- Também faz backfill dos que já foram confirmados manualmente sem lançar no financeiro.
-- Executar manualmente no Supabase SQL Editor.

-- ══════════════════════════════════════════════════════════════
-- 1. confirmar_inscricao_manual: ao confirmar, marca o pagamento 'pago'
--    (o gatilho fn_auto_financial_receita lança receita/taxa no financeiro)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION confirmar_inscricao_manual(
  p_registration_id uuid,
  p_acao            text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bib   int;
  v_event uuid;
BEGIN
  IF p_acao = 'confirmar' THEN
    SELECT event_id INTO v_event FROM registration WHERE id = p_registration_id;

    SELECT COALESCE(MAX(bib_number), 0) + 1
      INTO v_bib
      FROM registration
     WHERE event_id = v_event
       AND status::text = 'confirmado';

    UPDATE registration
       SET status     = 'confirmado'::reg_status,
           bib_number = v_bib
     WHERE id = p_registration_id
       AND status::text IN ('em_analise', 'pendente');

    -- Marca o pagamento como pago → dispara o lançamento no financeiro
    UPDATE payment
       SET status = 'pago'::pag_status, paid_at = now()
     WHERE registration_id = p_registration_id
       AND status <> 'pago'::pag_status;

    RETURN jsonb_build_object('ok', true, 'bib_number', v_bib);

  ELSIF p_acao = 'rejeitar' THEN
    UPDATE registration
       SET status = 'pendente'::reg_status
     WHERE id = p_registration_id
       AND status::text = 'em_analise';

    RETURN jsonb_build_object('ok', true, 'bib_number', null);

  ELSE
    RETURN jsonb_build_object('error', 'acao invalida');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION confirmar_inscricao_manual(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirmar_inscricao_manual(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION confirmar_inscricao_manual(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION confirmar_inscricao_manual(uuid, text) TO anon;

-- ══════════════════════════════════════════════════════════════
-- 2. BACKFILL — inscrições já CONFIRMADAS cujo pagamento não está 'pago'
--    passam a 'pago', gerando os lançamentos no financeiro que faltaram.
-- ══════════════════════════════════════════════════════════════
UPDATE payment p
   SET status = 'pago'::pag_status,
       paid_at = COALESCE(p.paid_at, now())
  FROM registration r
 WHERE p.registration_id = r.id
   AND r.status::text = 'confirmado'
   AND p.status <> 'pago'::pag_status;

-- ══════════════════════════════════════════════════════════════
-- VERIFICAÇÃO
-- ══════════════════════════════════════════════════════════════
-- SELECT tipo, categoria, count(*), sum(valor_centavos)
-- FROM financial_entry WHERE automatico = true GROUP BY 1,2;
