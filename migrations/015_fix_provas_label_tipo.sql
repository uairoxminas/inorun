-- migrations/015_fix_provas_label_tipo.sql
-- INO RUN 2026 — Corrige label, descricao e tipo das provas no banco
-- Executar manualmente no Supabase SQL Editor

-- ══════════════════════════════════════════════════════════════
-- 1. CORRIGIR O CAMPO tipo NAS PROVAS DE CORRIDA
--    (necessário para filtros do front-end funcionarem corretamente)
-- ══════════════════════════════════════════════════════════════
UPDATE race SET tipo = 'corrida'
  WHERE distancia_km IN (5, 10)
  AND (tipo IS NULL OR tipo NOT IN ('kids', 'caminhada'));

-- ══════════════════════════════════════════════════════════════
-- 2. CORRIGIR LABEL E DESCRICAO DA PROVA KIDS
--    Kids e 300 metros nao 5 km
-- ══════════════════════════════════════════════════════════════
UPDATE race
SET
  label        = 'Kids - 300 metros',
  descricao    = 'Corrida de 300 metros para criancas de 7 a 12 anos. Todos os participantes ganham medalha e sobem ao podio - nao ha classificacao competitiva, so celebracao!',
  distancia_km = 0
WHERE tipo = 'kids';

-- ══════════════════════════════════════════════════════════════
-- 3. CORRIGIR DESCRICAO DA CAMINHADA
--    Caminhada = todos ganham medalha (nao certificado)
-- ══════════════════════════════════════════════════════════════
UPDATE race
SET
  label     = 'Caminhada - 5 KM',
  descricao = 'Caminhada de 5 km, inclusiva e sem cronometragem competitiva. Aberta para qualquer idade. Todos os participantes ganham medalha e sobem ao podio!'
WHERE tipo = 'caminhada';

-- ══════════════════════════════════════════════════════════════
-- VERIFICACAO
-- ══════════════════════════════════════════════════════════════
-- SELECT id, label, descricao, distancia_km, tipo FROM race ORDER BY tipo, distancia_km;
