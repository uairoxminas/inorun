-- migrations/013_ajustes_v2.sql
-- INO RUN 2026 — Ajustes v2: preços corretos, camisetas Kids, sexo opcional, limpeza de dados
-- Executar manualmente no Supabase SQL Editor

-- ══════════════════════════════════════════════════════════════
-- 1. DELETAR INSCRIÇÕES EXISTENTES (pagamentos primeiro — FK)
-- ══════════════════════════════════════════════════════════════
-- ⚠️  ATENÇÃO: remove todos os pagamentos e inscrições do banco.
DELETE FROM financial_entry WHERE automatico = true;  -- remove lançamentos automáticos
DELETE FROM payment;
DELETE FROM registration;

-- ══════════════════════════════════════════════════════════════
-- 2. ATUALIZAR PREÇOS DE TODOS OS LOTES
--    Lote 1 = R$89,00 · Lote 2 = R$99,00 · Lote 3 = R$109,00
--    Válido para TODAS as provas (5km, 10km, Kids, Caminhada)
-- ══════════════════════════════════════════════════════════════
UPDATE pricing_lot SET preco_centavos =  8900 WHERE ordem = 1;
UPDATE pricing_lot SET preco_centavos =  9900 WHERE ordem = 2;
UPDATE pricing_lot SET preco_centavos = 10900 WHERE ordem = 3;

-- Verificar resultado:
-- SELECT r.label, pl.nome, pl.preco_centavos FROM pricing_lot pl JOIN race r ON pl.race_id = r.id ORDER BY r.label, pl.ordem;

-- ══════════════════════════════════════════════════════════════
-- 3. ADICIONAR TAMANHOS INFANTIS AO ENUM camiseta_tipo
--    Kids: 8, 10, 12 (além de PP e P que já existem)
-- ══════════════════════════════════════════════════════════════
ALTER TYPE camiseta_tipo ADD VALUE IF NOT EXISTS '8';
ALTER TYPE camiseta_tipo ADD VALUE IF NOT EXISTS '10';
ALTER TYPE camiseta_tipo ADD VALUE IF NOT EXISTS '12';

-- ══════════════════════════════════════════════════════════════
-- 4. TORNAR SEXO OPCIONAL NO ATLETA
--    Kids (7-12) e Caminhada não precisam de sexo para categoria
--    O campo é mantido para fins de cadastro/kit, mas não obrigatório
-- ══════════════════════════════════════════════════════════════
ALTER TABLE athlete ALTER COLUMN sexo DROP NOT NULL;

-- Atualizar a função upsert_atleta para aceitar sexo nulo
CREATE OR REPLACE FUNCTION upsert_atleta(
  p_nome       text,
  p_cpf        text,
  p_nascimento date,
  p_sexo       text DEFAULT NULL,  -- agora nullable (text para aceitar null sem tipo enum)
  p_email      text DEFAULT NULL,
  p_telefone   text DEFAULT NULL,
  p_emergencia text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id   uuid;
  v_sexo sexo_tipo;
BEGIN
  -- Converte texto para enum (ou null se não informado)
  IF p_sexo IS NOT NULL AND p_sexo IN ('M', 'F') THEN
    v_sexo := p_sexo::sexo_tipo;
  ELSE
    v_sexo := NULL;
  END IF;

  -- Busca atleta existente pelo CPF (LGPD: sem expor via API pública)
  SELECT id INTO v_id FROM athlete WHERE cpf = p_cpf;

  IF FOUND THEN
    -- Atleta já existe — retorna o ID sem expor outros dados
    RETURN jsonb_build_object('athlete_id', v_id);
  END IF;

  -- Cria novo atleta
  INSERT INTO athlete (nome, cpf, nascimento, sexo, email, telefone, contato_emergencia)
  VALUES (p_nome, p_cpf, p_nascimento, v_sexo, p_email, p_telefone, p_emergencia)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('athlete_id', v_id);

EXCEPTION WHEN unique_violation THEN
  SELECT id INTO v_id FROM athlete WHERE cpf = p_cpf;
  RETURN jsonb_build_object('athlete_id', v_id);
WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM, 'code', SQLSTATE);
END;
$$;

-- Re-conceder permissões (nova assinatura)
REVOKE ALL ON FUNCTION upsert_atleta(text,text,date,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_atleta(text,text,date,text,text,text,text) TO anon;
GRANT EXECUTE ON FUNCTION upsert_atleta(text,text,date,text,text,text,text) TO authenticated;

-- Revogar a assinatura antiga (com sexo_tipo obrigatório) se ainda existir
DROP FUNCTION IF EXISTS upsert_atleta(text,text,date,sexo_tipo,text,text,text);

-- ══════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ══════════════════════════════════════════════════════════════
-- SELECT count(*) FROM registration;   -- deve ser 0
-- SELECT count(*) FROM payment;        -- deve ser 0
-- SELECT nome, preco_centavos, ordem FROM pricing_lot ORDER BY ordem;
-- SELECT enum_range(NULL::camiseta_tipo);   -- deve incluir '8','10','12'
