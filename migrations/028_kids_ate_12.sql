-- migrations/028_kids_ate_12.sql
-- INO RUN 2026 — Categoria Kids agora é "até 12 anos" (sem mínimo de 7).
-- Atualiza a descrição da prova Kids exibida no site.
-- Executar manualmente no Supabase SQL Editor.

UPDATE race
SET descricao = 'Corrida de 300 metros para crianças de até 12 anos. Todos os participantes ganham medalha e sobem ao podio - nao ha classificacao competitiva, so celebracao!'
WHERE tipo = 'kids';

-- Verificação:
-- SELECT label, descricao FROM race WHERE tipo = 'kids';
