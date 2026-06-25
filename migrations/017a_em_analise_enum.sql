-- migrations/017a_em_analise_enum.sql
-- PASSO 1 DE 2 — Execute este script PRIMEIRO e aguarde completar
-- Adiciona o valor 'em_analise' ao enum e as colunas na pix_receipt

ALTER TYPE reg_status ADD VALUE IF NOT EXISTS 'em_analise';

ALTER TABLE pix_receipt
  ADD COLUMN IF NOT EXISTS comprovante_url   text,
  ADD COLUMN IF NOT EXISTS comprovante_mime  text,
  ADD COLUMN IF NOT EXISTS em_analise        boolean DEFAULT false;

-- Apos executar este script, execute o 017b_em_analise_funcoes.sql
