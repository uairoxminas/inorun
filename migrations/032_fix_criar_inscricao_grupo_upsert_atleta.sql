-- migrations/032_fix_criar_inscricao_grupo_upsert_atleta.sql
-- Correção da chamada de upsert_atleta na RPC criar_inscricao_grupo
-- Motivo: a assinatura de upsert_atleta exige p_sexo text e p_emergencia text, mas criar_inscricao_grupo passava (v_atleta->>'sexo')::sexo_tipo e NULL (unknown).

-- 1. Cria overload wrapper para upsert_atleta aceitando sexo_tipo para máxima compatibilidade
CREATE OR REPLACE FUNCTION upsert_atleta(
  p_nome text,
  p_cpf text,
  p_nasc date,
  p_sexo sexo_tipo,
  p_email text DEFAULT NULL,
  p_tel text DEFAULT NULL,
  p_emergencia text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN upsert_atleta(p_nome, p_cpf, p_nasc, p_sexo::text, p_email, p_tel, p_emergencia);
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_atleta(text, text, date, sexo_tipo, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION upsert_atleta(text, text, date, sexo_tipo, text, text, text) TO authenticated;

-- 2. Atualiza criar_inscricao_grupo para passar tipos text explícitos
CREATE OR REPLACE FUNCTION criar_inscricao_grupo(
  p_grupo jsonb,
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

    -- upsert atleta com conversão para text explícita
    v_upsert := upsert_atleta(
      v_atleta->>'nome',
      regexp_replace(v_atleta->>'cpf', '\D', '', 'g'),
      (v_atleta->>'nascimento')::date,
      (v_atleta->>'sexo')::text,
      lower(trim(v_atleta->>'email')),
      NULLIF(trim(v_atleta->>'telefone'), ''),
      NULL::text
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
