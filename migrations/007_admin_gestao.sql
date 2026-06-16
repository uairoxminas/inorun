-- migrations/007_admin_gestao.sql
-- Módulos do painel do organizador:
--   1. check_in (checked_in_at + fazer_checkin)
--   2. toggle de lotes
--   3. cancelar inscrição
--   4. gerenciar cupons

-- ── 1. Check-in ───────────────────────────────────────────────────────────
ALTER TABLE registration ADD COLUMN IF NOT EXISTS checked_in_at timestamptz DEFAULT NULL;

CREATE OR REPLACE FUNCTION fazer_checkin(p_bib int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reg record;
BEGIN
  SELECT r.id, r.status, r.checked_in_at, r.camiseta,
         a.nome, a.sexo,
         ra.label AS prova,
         r.category_id AS categoria
  INTO v_reg
  FROM registration r
  JOIN athlete a ON a.id = r.athlete_id
  JOIN race ra    ON ra.id = r.race_id
  WHERE r.bib_number = p_bib
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Bib não encontrado');
  END IF;

  IF v_reg.status <> 'confirmado' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Inscrição não confirmada (status: ' || v_reg.status || ')');
  END IF;

  IF v_reg.checked_in_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'erro', 'Atleta já fez check-in às ' || to_char(v_reg.checked_in_at AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'),
      'nome', v_reg.nome, 'categoria', v_reg.categoria, 'prova', v_reg.prova
    );
  END IF;

  UPDATE registration SET checked_in_at = NOW() WHERE id = v_reg.id;

  RETURN jsonb_build_object(
    'ok',       true,
    'nome',     v_reg.nome,
    'categoria', v_reg.categoria,
    'prova',    v_reg.prova,
    'camiseta', v_reg.camiseta
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fazer_checkin(int) TO anon;

-- ── 2. Toggle de lotes ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_toggle_lot(p_lot_id uuid, p_ativo bool)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Quando ativado manualmente, abre em now() e fecha em 10/10/2026 (véspera da prova)
  IF p_ativo THEN
    UPDATE pricing_lot
    SET abre_em  = NOW(),
        fecha_em = '2026-10-10 23:59:59-03'
    WHERE id = p_lot_id;
  ELSE
    -- Desativa: empurra fecha_em para o passado
    UPDATE pricing_lot
    SET fecha_em = NOW() - INTERVAL '1 second'
    WHERE id = p_lot_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_toggle_lot(uuid, bool) TO anon;

-- ── 3. Cancelar inscrição ─────────────────────────────────────────────────
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

  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_cancelar_inscricao(uuid) TO anon;

-- ── 4. Criar cupom ────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE cupom_tipo AS ENUM ('percentual', 'fixo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION admin_criar_cupom(
  p_codigo   text,
  p_tipo     text,  -- 'percentual' | 'fixo'
  p_valor    numeric,
  p_validade date DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO coupon (codigo, tipo, valor, ativo, validade)
  VALUES (
    UPPER(TRIM(p_codigo)),
    p_tipo::coupon_tipo,
    p_valor,
    true,
    COALESCE(p_validade, '2026-10-11')
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'erro', 'Código já existe');
WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_criar_cupom(text, text, numeric, date) TO anon;

-- ── 5. Desativar cupom ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_toggle_cupom(p_cupom_id uuid, p_ativo bool)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE coupon SET ativo = p_ativo WHERE id = p_cupom_id;
  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_toggle_cupom(uuid, bool) TO anon;

-- ── View de cupons (para o admin ver) ────────────────────────────────────
CREATE OR REPLACE VIEW vw_cupons AS
SELECT
  c.id,
  c.codigo,
  c.tipo::text,
  c.valor,
  c.ativo,
  c.validade,
  COUNT(r.id) AS usos
FROM coupon c
LEFT JOIN registration r ON r.cupom_id = c.id
GROUP BY c.id;

GRANT SELECT ON vw_cupons TO anon;
