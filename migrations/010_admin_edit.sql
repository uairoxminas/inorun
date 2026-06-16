-- migrations/010_admin_edit.sql
-- Permite editar inscrições e lotes pelo painel do organizador

-- ── 1. Editar inscrição ───────────────────────────────────────────────────
-- Atualiza campos editáveis de uma inscrição e do atleta vinculado
CREATE OR REPLACE FUNCTION admin_editar_inscricao(
  p_registration_id uuid,
  p_nome            text     DEFAULT NULL,
  p_email           text     DEFAULT NULL,
  p_telefone        text     DEFAULT NULL,
  p_camiseta        text     DEFAULT NULL,
  p_status          text     DEFAULT NULL,
  p_race_id         uuid     DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_athlete_id uuid;
BEGIN
  -- Busca o atleta da inscrição
  SELECT athlete_id INTO v_athlete_id FROM registration WHERE id = p_registration_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada');
  END IF;

  -- Atualiza dados do atleta (só os não-nulos)
  UPDATE athlete SET
    nome     = COALESCE(NULLIF(TRIM(p_nome), ''),    nome),
    email    = COALESCE(NULLIF(TRIM(p_email), ''),   email),
    telefone = COALESCE(NULLIF(TRIM(p_telefone), ''), telefone)
  WHERE id = v_athlete_id;

  -- Atualiza dados da inscrição
  UPDATE registration SET
    camiseta = COALESCE(NULLIF(p_camiseta, ''), camiseta),
    status   = COALESCE(NULLIF(p_status,   ''), status),
    race_id  = COALESCE(p_race_id,              race_id)
  WHERE id = p_registration_id;

  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_editar_inscricao(uuid,text,text,text,text,text,uuid) TO anon;

-- ── 2. Salvar lote (criar ou editar) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_salvar_lote(
  p_id             uuid     DEFAULT NULL,  -- NULL = criar novo
  p_race_id        uuid     DEFAULT NULL,
  p_nome           text     DEFAULT NULL,
  p_preco_centavos bigint   DEFAULT NULL,
  p_abre_em        timestamptz DEFAULT NULL,
  p_fecha_em       timestamptz DEFAULT NULL,
  p_ordem          int      DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id uuid;
BEGIN
  IF p_id IS NOT NULL THEN
    -- Editar existente
    UPDATE pricing_lot SET
      nome           = COALESCE(p_nome,           nome),
      preco_centavos = COALESCE(p_preco_centavos, preco_centavos),
      abre_em        = COALESCE(p_abre_em,        abre_em),
      fecha_em       = COALESCE(p_fecha_em,       fecha_em),
      ordem          = COALESCE(p_ordem,          ordem)
    WHERE id = p_id
    RETURNING id INTO v_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'Lote não encontrado');
    END IF;
  ELSE
    -- Criar novo
    IF p_race_id IS NULL OR p_nome IS NULL OR p_preco_centavos IS NULL
       OR p_abre_em IS NULL OR p_fecha_em IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'Campos obrigatórios: race_id, nome, preco, datas');
    END IF;

    INSERT INTO pricing_lot (race_id, nome, preco_centavos, abre_em, fecha_em, ordem)
    VALUES (p_race_id, p_nome, p_preco_centavos, p_abre_em, p_fecha_em, COALESCE(p_ordem, 99))
    RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_salvar_lote(uuid,uuid,text,bigint,timestamptz,timestamptz,int) TO anon;

-- ── 3. Deletar lote ───────────────────────────────────────────────────────
-- Só permite deletar se não houver inscrições vinculadas a esse lote
CREATE OR REPLACE FUNCTION admin_deletar_lote(p_lot_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_usos int;
BEGIN
  SELECT COUNT(*) INTO v_usos FROM registration WHERE lot_id = p_lot_id;

  IF v_usos > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'erro', 'Lote possui ' || v_usos || ' inscrição(ões) vinculada(s). Cancele-as antes de deletar.'
    );
  END IF;

  DELETE FROM pricing_lot WHERE id = p_lot_id;
  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_deletar_lote(uuid) TO anon;
