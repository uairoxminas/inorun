-- migrations/012_categorias_v2.sql
-- INO RUN 2026 — Reestruturação de Categorias v2
-- Executar manualmente no Supabase SQL Editor
--
-- MUDANÇAS:
--   1. Adiciona coluna `tipo` na tabela `race` ('corrida' | 'kids' | 'caminhada')
--   2. Marca as provas existentes como tipo 'corrida'
--   3. Insere as novas provas: Kids 5 km e Caminhada 5 km
--   4. Cria lotes de preço para Kids e Caminhada (mesmos valores da Prova 5 km - Lote 1)
--   5. Atualiza o campo `sexo` em race_result para suportar Kids (sem sexo obrigatório)
--   6. Adiciona índice de categoria em race_result para queries de premiação

-- ══════════════════════════════════════════════════════════════
-- 1. Adicionar coluna tipo na tabela race
-- ══════════════════════════════════════════════════════════════
ALTER TABLE race
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'corrida'
  CHECK (tipo IN ('corrida', 'kids', 'caminhada'));

-- ══════════════════════════════════════════════════════════════
-- 2. Marcar provas existentes como tipo 'corrida'
-- ══════════════════════════════════════════════════════════════
UPDATE race SET tipo = 'corrida'
WHERE event_id = (SELECT id FROM event WHERE slug = 'inorun-2026')
  AND tipo = 'corrida'; -- já é o default, mas explicitando

-- ══════════════════════════════════════════════════════════════
-- 3. Inserir novas provas: Kids 5 km e Caminhada 5 km
-- ══════════════════════════════════════════════════════════════
INSERT INTO race (event_id, distancia_km, label, descricao, vagas_total, tipo)
SELECT
  e.id,
  prova.distancia_km,
  prova.label,
  prova.descricao,
  prova.vagas,
  prova.tipo
FROM event e,
(VALUES
  (5, 'Kids 5 km',       'Para crianças de 7 a 12 anos. Todos os participantes ganham medalha e sobem ao pódio!', 150, 'kids'),
  (5, 'Caminhada 5 km',  'Caminhada de 5 km para todas as idades. Sem cronometragem competitiva. Certificado de participação.',  200, 'caminhada')
) AS prova(distancia_km, label, descricao, vagas, tipo)
WHERE e.slug = 'inorun-2026'
  AND NOT EXISTS (
    SELECT 1 FROM race r2
    WHERE r2.event_id = e.id AND r2.label = prova.label
  );

-- ══════════════════════════════════════════════════════════════
-- 4. Criar lotes de preço para Kids e Caminhada
--    Usando mesmos valores e datas da Prova 5 km
-- ══════════════════════════════════════════════════════════════
INSERT INTO pricing_lot (race_id, nome, preco_centavos, abre_em, fecha_em, ordem)
SELECT
  r.id,
  lote.nome,
  lote.preco_centavos,
  lote.abre_em::timestamptz,
  lote.fecha_em::timestamptz,
  lote.ordem
FROM race r
JOIN event e ON r.event_id = e.id
, (VALUES
  ('Lote 1', 7900, '2026-01-01 00:00:00-03', '2026-07-31 23:59:59-03', 1),
  ('Lote 2', 8900, '2026-08-01 00:00:00-03', '2026-09-30 23:59:59-03', 2),
  ('Lote 3', 9900, '2026-10-01 00:00:00-03', '2026-10-10 23:59:59-03', 3)
) AS lote(nome, preco_centavos, abre_em, fecha_em, ordem)
WHERE e.slug = 'inorun-2026'
  AND r.tipo IN ('kids', 'caminhada')
  AND NOT EXISTS (
    SELECT 1 FROM pricing_lot pl2 WHERE pl2.race_id = r.id AND pl2.ordem = lote.ordem
  );

-- ══════════════════════════════════════════════════════════════
-- 5. Atualizar race_result para suportar categorias especiais
--    (Kids Geral e Caminhada não têm sexo obrigatório na categoria)
-- ══════════════════════════════════════════════════════════════

-- Tornar sexo opcional em race_result (Kids/Caminhada podem não ter sexo na categoria)
ALTER TABLE public.race_result
  ALTER COLUMN sexo DROP NOT NULL;

-- Permitir NULL no sexo (já que Kids e Caminhada não têm sexo competitivo)
ALTER TABLE public.race_result
  DROP CONSTRAINT IF EXISTS race_result_sexo_check;

ALTER TABLE public.race_result
  ADD CONSTRAINT race_result_sexo_check
  CHECK (sexo IS NULL OR sexo IN ('M', 'F'));

-- ══════════════════════════════════════════════════════════════
-- 6. Índices adicionais para queries de premiação
-- ══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_race_result_categoria
  ON public.race_result(categoria);

CREATE INDEX IF NOT EXISTS idx_race_result_tipo_categoria
  ON public.race_result(distancia_km, categoria, colocacao_categoria);

-- ══════════════════════════════════════════════════════════════
-- 7. Adicionar coluna tipo em race_result para distinguir premiação
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.race_result
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'corrida'
  CHECK (tipo IN ('corrida', 'kids', 'caminhada'));

-- ══════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — rode após aplicar para confirmar
-- ══════════════════════════════════════════════════════════════
-- SELECT id, label, distancia_km, tipo, vagas_total FROM race ORDER BY tipo, distancia_km;
-- SELECT r.label, COUNT(pl.*) as lotes FROM race r LEFT JOIN pricing_lot pl ON pl.race_id = r.id GROUP BY r.label;
