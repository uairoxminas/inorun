-- migrations/034_financeiro_apenas_confirmados.sql
-- INO RUN 2026 — No controle financeiro só devem constar inscrições e taxas
-- efetivamente CONFIRMADAS/PAGAS. Remove lançamentos órfãos e mantém sincronia
-- ao cancelar/deletar inscrições.
-- Executar manualmente no Supabase SQL Editor.

-- ══════════════════════════════════════════════════════════════
-- 1. LIMPEZA — remove lançamentos automáticos sem inscrição confirmada/paga
--    (órfãos de inscrições de teste que foram apagadas/canceladas)
-- ══════════════════════════════════════════════════════════════
DELETE FROM financial_entry fe
WHERE fe.automatico = true
  AND fe.categoria IN ('inscricao', 'taxa_plataforma')
  AND NOT EXISTS (
    SELECT 1
    FROM payment p
    JOIN registration r ON r.id = p.registration_id
    WHERE p.id = fe.referencia
      AND p.status = 'pago'
      AND r.status = 'confirmado'
  );

-- ══════════════════════════════════════════════════════════════
-- 2. GATILHO — ao DELETAR um pagamento, remove seus lançamentos automáticos
--    (cobre a exclusão de inscrições — ex. migration 030 — sem deixar órfãos)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION fn_del_financial_on_payment_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM financial_entry
  WHERE automatico = true AND referencia = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_del_financial_on_payment ON payment;
CREATE TRIGGER trg_del_financial_on_payment
  BEFORE DELETE ON payment
  FOR EACH ROW EXECUTE FUNCTION fn_del_financial_on_payment_delete();

-- ══════════════════════════════════════════════════════════════
-- 3. CANCELAR INSCRIÇÃO — também remove os lançamentos automáticos do financeiro
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION admin_cancelar_inscricao(p_registration_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE registration
  SET status = 'cancelado',
      bib_number = NULL
  WHERE id = p_registration_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada');
  END IF;

  -- Remove receita/taxa automáticas dessa inscrição (só confirmados-pagos constam)
  DELETE FROM financial_entry
  WHERE automatico = true
    AND referencia IN (SELECT id FROM payment WHERE registration_id = p_registration_id);

  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_cancelar_inscricao(uuid) TO anon;
GRANT EXECUTE ON FUNCTION admin_cancelar_inscricao(uuid) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- VERIFICAÇÃO (deve refletir só o que está confirmado/pago)
-- ══════════════════════════════════════════════════════════════
-- SELECT tipo, categoria, count(*), sum(valor_centavos)
-- FROM financial_entry WHERE automatico = true GROUP BY 1,2;
