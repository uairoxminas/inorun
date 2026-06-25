-- migrations/017b_em_analise_funcoes.sql
-- PASSO 2 DE 2 — Execute APOS o 017a ter completado com sucesso
-- Cria a funcao confirmar_inscricao_manual e a view inscricoes_em_analise

-- ══════════════════════════════════════════════════════════════
-- FUNCAO: confirmar_inscricao_manual (usado pelo painel admin)
-- p_acao: 'confirmar' ou 'rejeitar'
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
           bib_number = v_bib,
           updated_at = now()
     WHERE id = p_registration_id
       AND status::text IN ('em_analise', 'pendente');

    RETURN jsonb_build_object('ok', true, 'bib_number', v_bib);

  ELSIF p_acao = 'rejeitar' THEN
    UPDATE registration
       SET status     = 'pendente'::reg_status,
           updated_at = now()
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

-- ══════════════════════════════════════════════════════════════
-- VIEW: inscricoes_em_analise
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW inscricoes_em_analise AS
SELECT
  r.id           AS registration_id,
  r.status,
  r.created_at,
  a.nome         AS atleta_nome,
  a.email        AS atleta_email,
  a.cpf,
  rc.label       AS prova_label,
  r.camiseta,
  pr.comprovante_url,
  pr.comprovante_mime,
  pr.gemini_resultado,
  pr.gemini_motivo
FROM registration r
JOIN athlete      a  ON a.id  = r.athlete_id
JOIN race         rc ON rc.id = r.race_id
LEFT JOIN pix_receipt pr ON pr.registration_id = r.id
WHERE r.status::text = 'em_analise'
ORDER BY r.created_at ASC;

GRANT SELECT ON inscricoes_em_analise TO authenticated;
