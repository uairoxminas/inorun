-- migrations/011_resultados.sql
-- Estrutura de dados para o módulo de resultados do atleta

-- 1. Criação da tabela de resultados
CREATE TABLE IF NOT EXISTS public.race_result (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bib_number INTEGER NOT NULL,
    nome VARCHAR(255) NOT NULL,
    sexo CHAR(1) CHECK (sexo IN ('M', 'F')),
    distancia_km NUMERIC NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    tempo_bruto VARCHAR(20) NOT NULL,
    tempo_liquido VARCHAR(20) NOT NULL,
    pace VARCHAR(20),
    colocacao_geral INTEGER,
    colocacao_sexo INTEGER,
    colocacao_categoria INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Índices de busca
CREATE INDEX IF NOT EXISTS idx_race_result_bib ON public.race_result(bib_number);
CREATE INDEX IF NOT EXISTS idx_race_result_nome_trgm ON public.race_result(nome);
CREATE INDEX IF NOT EXISTS idx_race_result_dist_geral ON public.race_result(distancia_km, colocacao_geral);

-- 3. Habilitar RLS
ALTER TABLE public.race_result ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS
-- Qualquer usuário anônimo ou autenticado pode ler resultados
CREATE POLICY "Leitura pública de resultados" ON public.race_result
    FOR SELECT USING (true);

-- Administradores controlam a tabela via funções do SECURITY DEFINER, mas adicionamos
-- política para gravação direta se necessário (com service_role)
CREATE POLICY "Service role gerencia tudo" ON public.race_result
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 5. Função SECURITY DEFINER para limpar resultados de uma prova ou todos
CREATE OR REPLACE FUNCTION admin_limpar_resultados(p_distancia numeric DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_distancia IS NOT NULL THEN
    DELETE FROM public.race_result WHERE distancia_km = p_distancia;
  ELSE
    DELETE FROM public.race_result WHERE id IS NOT NULL;
  END IF;
  
  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_limpar_resultados(numeric) TO anon;

-- 6. Função SECURITY DEFINER para importar lista de resultados em lote de forma idempotente
-- Recebe um array de json contendo os dados dos corredores
CREATE OR REPLACE FUNCTION admin_importar_resultados(p_resultados jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item jsonb;
  v_count int := 0;
BEGIN
  -- Percorre o array de json e faz o insert
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_resultados) LOOP
    INSERT INTO public.race_result (
      bib_number, nome, sexo, distancia_km, categoria,
      tempo_bruto, tempo_liquido, pace,
      colocacao_geral, colocacao_sexo, colocacao_categoria
    ) VALUES (
      (v_item->>'bib_number')::integer,
      v_item->>'nome',
      v_item->>'sexo',
      (v_item->>'distancia_km')::numeric,
      v_item->>'categoria',
      v_item->>'tempo_bruto',
      v_item->>'tempo_liquido',
      v_item->>'pace',
      (v_item->>'colocacao_geral')::integer,
      (v_item->>'colocacao_sexo')::integer,
      (v_item->>'colocacao_categoria')::integer
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'importados', v_count);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_importar_resultados(jsonb) TO anon;
