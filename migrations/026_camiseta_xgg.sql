-- migrations/026_camiseta_xgg.sql
-- INO RUN 2026 — Novos tamanhos no enum camiseta_tipo:
--   XGG (adulto, tabela oficial) + 4, 6, 14 (infantil).
-- Rodar SOZINHO (ALTER TYPE ADD VALUE não pode ser usado na mesma transação em que o valor é usado).
-- Executar manualmente no Supabase SQL Editor.

ALTER TYPE camiseta_tipo ADD VALUE IF NOT EXISTS 'XGG';
ALTER TYPE camiseta_tipo ADD VALUE IF NOT EXISTS '4';
ALTER TYPE camiseta_tipo ADD VALUE IF NOT EXISTS '6';
ALTER TYPE camiseta_tipo ADD VALUE IF NOT EXISTS '14';

-- Verificação:
-- SELECT enum_range(NULL::camiseta_tipo);
