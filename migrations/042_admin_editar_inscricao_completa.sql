-- migrations/042_admin_editar_inscricao_completa.sql
-- INO RUN 2026 — Edição completa da inscrição pelo painel.
-- 1) vw_inscritos ganha nascimento, contato_emergencia e race_id (colunas novas no fim).
-- 2) admin_editar_inscricao_completa(p_registration_id, p_dados jsonb): altera só as chaves
--    presentes em p_dados. Atleta: nome, cpf, nascimento, sexo, email, telefone,
--    contato_emergencia. Inscrição: race_id, categoria, camiseta, camiseta_modelo, status,
--    bib_number. Ao trocar a prova, o lote passa para o de mesmo nome na prova nova.

CREATE OR REPLACE VIEW vw_inscritos AS
 SELECT r.id AS registration_id,
    a.nome,
    a.email,
    a.cpf,
    a.sexo,
    a.telefone,
    rc.distancia_km AS distancia,
    rc.label AS prova,
    r.category_id AS categoria,
    r.camiseta,
    r.camiseta_modelo,
    r.bib_number,
    r.status,
    pl.nome AS lote,
    pl.preco_centavos,
    p.valor_centavos AS valor_pago,
    p.taxa_plataforma_centavos AS taxa_paga,
    p.metodo AS pagamento,
    p.status AS pag_status,
    p.paid_at,
    r.created_at,
    COALESCE(r.comprovante_url, pr.comprovante_url) AS comprovante_url,
    pr.gemini_motivo,
    pr.gemini_resultado,
    a.nascimento,
    a.contato_emergencia,
    r.race_id
   FROM registration r
     JOIN athlete a ON r.athlete_id = a.id
     JOIN race rc ON r.race_id = rc.id
     JOIN pricing_lot pl ON r.lot_id = pl.id
     LEFT JOIN payment p ON p.registration_id = r.id
     LEFT JOIN pix_receipt pr ON pr.registration_id = r.id
  ORDER BY r.created_at DESC;

CREATE OR REPLACE FUNCTION admin_editar_inscricao_completa(p_registration_id uuid, p_dados jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reg      registration%ROWTYPE;
  v_race_id  uuid;
  v_lot_id   uuid;
  v_cpf      text;
  v_cons     text;
BEGIN
  SELECT * INTO v_reg FROM registration WHERE id = p_registration_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  END IF;

  -- ── Atleta ──
  IF p_dados ? 'cpf' THEN
    v_cpf := regexp_replace(COALESCE(p_dados->>'cpf', ''), '\D', '', 'g');
    IF length(v_cpf) <> 11 THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'CPF deve ter 11 dígitos.');
    END IF;
  END IF;

  UPDATE athlete SET
    nome       = CASE WHEN p_dados ? 'nome'  AND NULLIF(TRIM(p_dados->>'nome'), '')  IS NOT NULL THEN TRIM(p_dados->>'nome') ELSE nome END,
    cpf        = CASE WHEN p_dados ? 'cpf' THEN v_cpf ELSE cpf END,
    nascimento = CASE WHEN p_dados ? 'nascimento' AND NULLIF(p_dados->>'nascimento', '') IS NOT NULL THEN (p_dados->>'nascimento')::date ELSE nascimento END,
    sexo       = CASE WHEN p_dados ? 'sexo' THEN NULLIF(p_dados->>'sexo', '')::sexo_tipo ELSE sexo END,
    email      = CASE WHEN p_dados ? 'email' AND NULLIF(TRIM(p_dados->>'email'), '') IS NOT NULL THEN lower(TRIM(p_dados->>'email')) ELSE email END,
    telefone   = CASE WHEN p_dados ? 'telefone' THEN NULLIF(TRIM(p_dados->>'telefone'), '') ELSE telefone END,
    contato_emergencia = CASE WHEN p_dados ? 'contato_emergencia' THEN NULLIF(TRIM(p_dados->>'contato_emergencia'), '') ELSE contato_emergencia END
  WHERE id = v_reg.athlete_id;

  -- ── Inscrição ──
  v_race_id := v_reg.race_id;
  v_lot_id  := v_reg.lot_id;
  IF p_dados ? 'race_id' AND (p_dados->>'race_id')::uuid <> v_reg.race_id THEN
    v_race_id := (p_dados->>'race_id')::uuid;
    -- Lote equivalente (mesmo nome) na prova nova; sem equivalente, mantém o atual
    SELECT n.id INTO v_lot_id
    FROM pricing_lot atual JOIN pricing_lot n ON n.nome = atual.nome AND n.race_id = v_race_id
    WHERE atual.id = v_reg.lot_id
    LIMIT 1;
    v_lot_id := COALESCE(v_lot_id, v_reg.lot_id);
  END IF;

  UPDATE registration SET
    race_id         = v_race_id,
    lot_id          = v_lot_id,
    category_id     = CASE WHEN p_dados ? 'categoria' AND NULLIF(p_dados->>'categoria', '') IS NOT NULL THEN p_dados->>'categoria' ELSE category_id END,
    camiseta        = CASE WHEN p_dados ? 'camiseta' THEN NULLIF(p_dados->>'camiseta', '')::camiseta_tipo ELSE camiseta END,
    camiseta_modelo = CASE WHEN p_dados ? 'camiseta_modelo' THEN NULLIF(p_dados->>'camiseta_modelo', '') ELSE camiseta_modelo END,
    status          = CASE WHEN p_dados ? 'status' THEN (p_dados->>'status')::reg_status ELSE status END,
    bib_number      = CASE WHEN p_dados ? 'bib_number' THEN NULLIF(p_dados->>'bib_number', '')::int ELSE bib_number END
  WHERE id = p_registration_id;

  RETURN jsonb_build_object('ok', true);
EXCEPTION
  WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_cons = CONSTRAINT_NAME;
    RETURN jsonb_build_object('ok', false, 'erro', CASE v_cons
      WHEN 'athlete_cpf_key'                     THEN 'Este CPF já pertence a outro atleta cadastrado.'
      WHEN 'registration_bib_number_key'         THEN 'Este número de peito já está em uso por outra inscrição.'
      WHEN 'registration_race_id_athlete_id_key' THEN 'Este atleta já tem outra inscrição nessa prova.'
      ELSE SQLERRM END);
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_editar_inscricao_completa(uuid, jsonb) TO anon, authenticated;
