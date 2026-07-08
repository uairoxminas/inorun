-- migrations/035_admin_excluir_inscricao.sql
-- INO RUN 2026 — Permite excluir permanentemente uma inscrição CANCELADA pelo painel.
-- Remove o pagamento (o gatilho da migration 034 limpa o financeiro) e a inscrição.
-- Segurança: só exclui inscrições com status 'cancelado'.
-- Executar manualmente no Supabase SQL Editor.

CREATE OR REPLACE FUNCTION admin_excluir_inscricao(p_registration_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status::text INTO v_status FROM registration WHERE id = p_registration_id;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  END IF;

  IF v_status <> 'cancelado' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Só é possível excluir inscrições canceladas. Cancele a inscrição antes.');
  END IF;

  -- Remove pagamentos (o gatilho BEFORE DELETE limpa os lançamentos do financeiro)
  DELETE FROM payment WHERE registration_id = p_registration_id;
  -- Remove comprovantes/pix_receipt se existirem
  DELETE FROM pix_receipt WHERE registration_id = p_registration_id;
  -- Remove a inscrição
  DELETE FROM registration WHERE id = p_registration_id;

  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_excluir_inscricao(uuid) TO anon;
GRANT EXECUTE ON FUNCTION admin_excluir_inscricao(uuid) TO authenticated;
