-- migrations/025_camiseta_modelo.sql
-- INO RUN 2026 — Modelo da camiseta: UNISSEX (com manga) ou BABY LOOK.
-- Tamanhos iguais (PP..XG). Aplica a todas as modalidades e ao fluxo de grupo.
-- Executar manualmente no Supabase SQL Editor.

-- ══════════════════════════════════════════════════════════════
-- 1. COLUNA camiseta_modelo NA registration
--    Texto simples com CHECK; default 'unissex' p/ inscrições antigas.
-- ══════════════════════════════════════════════════════════════
ALTER TABLE registration
  ADD COLUMN IF NOT EXISTS camiseta_modelo text NOT NULL DEFAULT 'unissex';

DO $$ BEGIN
  ALTER TABLE registration
    ADD CONSTRAINT registration_camiseta_modelo_chk
    CHECK (camiseta_modelo IN ('unissex', 'babylook'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 2. vw_inscritos — inclui camiseta_modelo
--    DROP + CREATE (não dá pra inserir coluna no meio via REPLACE).
--    Mantém comprovante_url (adicionada na migration 020).
-- ══════════════════════════════════════════════════════════════
DROP VIEW IF EXISTS vw_inscritos;
CREATE VIEW vw_inscritos AS
SELECT
  r.id            AS registration_id,
  a.nome,
  a.email,
  a.cpf,
  a.sexo,
  rc.distancia_km AS distancia,
  rc.label        AS prova,
  r.category_id   AS categoria,
  r.camiseta,
  r.camiseta_modelo,
  r.bib_number,
  r.status,
  pl.nome         AS lote,
  pl.preco_centavos,
  p.metodo        AS pagamento,
  p.status        AS pag_status,
  p.paid_at,
  r.created_at,
  r.comprovante_url
FROM registration r
JOIN athlete      a  ON r.athlete_id = a.id
JOIN race         rc ON r.race_id    = rc.id
JOIN pricing_lot  pl ON r.lot_id     = pl.id
LEFT JOIN payment p  ON p.registration_id = r.id
ORDER BY r.created_at DESC;

GRANT SELECT ON vw_inscritos TO anon;
GRANT SELECT ON vw_inscritos TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- 3. vw_grupo_atletas — inclui camiseta_modelo (DROP + CREATE)
-- ══════════════════════════════════════════════════════════════
DROP VIEW IF EXISTS vw_grupo_atletas;
CREATE VIEW vw_grupo_atletas AS
SELECT
  r.group_id,
  r.id            AS registration_id,
  a.nome,
  a.cpf,
  a.email,
  a.sexo,
  rc.label        AS prova,
  rc.distancia_km,
  r.category_id   AS categoria,
  r.camiseta,
  r.camiseta_modelo,
  r.bib_number,
  r.status
FROM registration r
JOIN athlete a  ON a.id  = r.athlete_id
JOIN race    rc ON rc.id = r.race_id
WHERE r.group_id IS NOT NULL
ORDER BY a.nome;

GRANT SELECT ON vw_grupo_atletas TO anon;
GRANT SELECT ON vw_grupo_atletas TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- 4. RPC criar_inscricao_grupo — passa camiseta_modelo por atleta
--    (default 'unissex' se ausente)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION criar_inscricao_grupo(
  p_grupo   jsonb,
  p_atletas jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id   uuid;
  v_group_id   uuid;
  v_qtd        int;
  v_idx        int := 0;
  v_atleta     jsonb;
  v_athlete_id uuid;
  v_lot_id     uuid;
  v_reg_id     uuid;
  v_upsert     jsonb;
  v_preco      int := 8900;
  v_taxa       int := 500;
BEGIN
  v_qtd := jsonb_array_length(p_atletas);
  IF v_qtd IS NULL OR v_qtd < 10 THEN
    RETURN jsonb_build_object('error', 'Grupo exige no mínimo 10 atletas.');
  END IF;

  SELECT id INTO v_event_id FROM event WHERE slug = 'inorun-2026';
  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Evento não encontrado.');
  END IF;

  INSERT INTO registration_group (
    event_id, nome_grupo, responsavel_nome, responsavel_email, responsavel_telefone,
    qtd_atletas, preco_unitario_centavos, taxa_unitaria_centavos, valor_total_centavos, status
  ) VALUES (
    v_event_id,
    p_grupo->>'nome_grupo',
    p_grupo->>'responsavel_nome',
    p_grupo->>'responsavel_email',
    p_grupo->>'responsavel_telefone',
    v_qtd, v_preco, v_taxa, v_qtd * (v_preco + v_taxa), 'pendente'
  )
  RETURNING id INTO v_group_id;

  FOR v_atleta IN SELECT * FROM jsonb_array_elements(p_atletas)
  LOOP
    v_idx := v_idx + 1;

    v_upsert := upsert_atleta(
      v_atleta->>'nome',
      regexp_replace(v_atleta->>'cpf', '\D', '', 'g'),
      (v_atleta->>'nascimento')::date,
      (v_atleta->>'sexo')::sexo_tipo,
      lower(trim(v_atleta->>'email')),
      NULLIF(trim(v_atleta->>'telefone'), ''),
      NULL
    );
    IF v_upsert ? 'error' THEN
      RAISE EXCEPTION 'Atleta % (%): %', v_idx, v_atleta->>'nome', v_upsert->>'error';
    END IF;
    v_athlete_id := (v_upsert->>'athlete_id')::uuid;

    SELECT id INTO v_lot_id
    FROM pricing_lot
    WHERE race_id = (v_atleta->>'race_id')::uuid AND nome = 'Grupo (10+)'
    LIMIT 1;
    IF v_lot_id IS NULL THEN
      RAISE EXCEPTION 'Prova sem lote de grupo configurado (atleta %).', v_atleta->>'nome';
    END IF;

    BEGIN
      INSERT INTO registration (
        event_id, race_id, athlete_id, lot_id, category_id, camiseta, camiseta_modelo, status, group_id
      ) VALUES (
        v_event_id,
        (v_atleta->>'race_id')::uuid,
        v_athlete_id,
        v_lot_id,
        v_atleta->>'categoria',
        (v_atleta->>'camiseta')::camiseta_tipo,
        COALESCE(NULLIF(v_atleta->>'camiseta_modelo', ''), 'unissex'),
        'pendente'::reg_status,
        v_group_id
      )
      RETURNING id INTO v_reg_id;
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'O CPF do atleta "%" já está inscrito nesta prova.', v_atleta->>'nome';
    END;

    INSERT INTO payment (
      registration_id, gateway, metodo, valor_centavos, taxa_plataforma_centavos, status, gateway_ref
    ) VALUES (
      v_reg_id, 'pix_grupo', 'pix'::pag_metodo, v_preco, v_taxa, 'criado'::pag_status,
      'grupo_' || v_group_id::text || '_' || v_idx::text
    );
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'group_id', v_group_id,
    'qtd_atletas', v_qtd,
    'valor_total_centavos', v_qtd * (v_preco + v_taxa)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION criar_inscricao_grupo(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION criar_inscricao_grupo(jsonb, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION criar_inscricao_grupo(jsonb, jsonb) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- VERIFICAÇÃO
-- ══════════════════════════════════════════════════════════════
-- SELECT camiseta, camiseta_modelo, count(*) FROM registration GROUP BY 1,2;
