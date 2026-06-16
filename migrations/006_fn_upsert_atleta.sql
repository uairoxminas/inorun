-- migrations/006_fn_upsert_atleta.sql
-- Função segura para criar/retornar atleta sem expor dados via SELECT anon
-- SECURITY DEFINER: executa com privilégios do owner (postgres), não do chamador (anon)
-- Invariante LGPD: anon nunca faz SELECT em athlete diretamente

CREATE OR REPLACE FUNCTION upsert_atleta(
  p_nome       text,
  p_cpf        text,
  p_nascimento date,
  p_sexo       sexo_tipo,
  p_email      text,
  p_telefone   text DEFAULT NULL,
  p_emergencia text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Busca atleta existente pelo CPF (LGPD: sem expor via API pública)
  SELECT id INTO v_id FROM athlete WHERE cpf = p_cpf;

  IF FOUND THEN
    -- Atleta já existe — retorna o ID sem expor outros dados
    RETURN jsonb_build_object('athlete_id', v_id);
  END IF;

  -- Cria novo atleta
  INSERT INTO athlete (nome, cpf, nascimento, sexo, email, telefone, contato_emergencia)
  VALUES (p_nome, p_cpf, p_nascimento, p_sexo, p_email, p_telefone, p_emergencia)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('athlete_id', v_id);

EXCEPTION WHEN unique_violation THEN
  -- Race condition: CPF inserido simultaneamente — busca o existente
  SELECT id INTO v_id FROM athlete WHERE cpf = p_cpf;
  RETURN jsonb_build_object('athlete_id', v_id);
WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM, 'code', SQLSTATE);
END;
$$;

-- Apenas anon e authenticated podem chamar esta função
REVOKE ALL ON FUNCTION upsert_atleta(text,text,date,sexo_tipo,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_atleta(text,text,date,sexo_tipo,text,text,text) TO anon;
GRANT EXECUTE ON FUNCTION upsert_atleta(text,text,date,sexo_tipo,text,text,text) TO authenticated;
