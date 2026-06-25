-- migrations/021_fix_confirmar_inscricao_manual.sql
-- Corrige confirmar_inscricao_manual removendo updated_at
-- (coluna nao existe na tabela registration)
-- Executar no Supabase SQL Editor

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

-- Verifica
SELECT proname, prosrc LIKE '%updated_at%' as tem_updated_at
FROM pg_proc WHERE proname = 'confirmar_inscricao_manual';
