-- migrations/033_fix_admin_criar_cupom.sql
-- INO RUN 2026 — Corrige admin_criar_cupom: cast para o enum correto.
-- O enum do banco é 'cupom_tipo' (não 'coupon_tipo'). Sem isso, criar cupom
-- pelo painel falha com: type "coupon_tipo" does not exist.
-- Executar manualmente no Supabase SQL Editor.

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
    p_tipo::cupom_tipo,
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
GRANT EXECUTE ON FUNCTION admin_criar_cupom(text, text, numeric, date) TO authenticated;
