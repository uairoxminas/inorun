-- migrations/022_fix_admin_editar_inscricao.sql
-- Corrige COALESCE types text e camiseta_tipo / reg_status
-- O PostgreSQL nao faz cast implicito de text para enums customizados
-- Executar no Supabase SQL Editor

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
  -- Busca o atleta da inscricao
  SELECT athlete_id INTO v_athlete_id FROM registration WHERE id = p_registration_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Inscricao nao encontrada');
  END IF;

  -- Atualiza dados do atleta (so os nao-nulos)
  UPDATE athlete SET
    nome     = COALESCE(NULLIF(TRIM(p_nome),      ''), nome),
    email    = COALESCE(NULLIF(TRIM(p_email),     ''), email),
    telefone = COALESCE(NULLIF(TRIM(p_telefone),  ''), telefone)
  WHERE id = v_athlete_id;

  -- Atualiza dados da inscricao (cast explicito para os enums)
  UPDATE registration SET
    camiseta = COALESCE(NULLIF(p_camiseta, '')::camiseta_tipo, camiseta),
    status   = COALESCE(NULLIF(p_status,   '')::reg_status,   status),
    race_id  = COALESCE(p_race_id,                            race_id)
  WHERE id = p_registration_id;

  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_editar_inscricao(uuid,text,text,text,text,text,uuid) TO authenticated;

-- Verifica
SELECT 'admin_editar_inscricao OK' as resultado;
