-- migrations/031_add_telefone_to_vw_inscritos.sql
-- INO RUN 2026 — Adiciona a coluna telefone à view vw_inscritos.
-- Necessário para carregar o telefone do atleta no painel admin e enviar mensagens de WhatsApp.
-- Executar manualmente no Supabase SQL Editor.

-- ══════════════════════════════════════════════════════════════
-- 1. RECRIA A VIEW vw_inscritos COM O CAMPO a.telefone
-- ══════════════════════════════════════════════════════════════
DROP VIEW IF EXISTS vw_inscritos CASCADE;

CREATE VIEW vw_inscritos AS
SELECT
  r.id            AS registration_id,
  a.nome,
  a.email,
  a.cpf,
  a.sexo,
  a.telefone,      -- Novo campo adicionado
  rc.distancia_km AS distancia,
  rc.label        AS prova,
  r.category_id   AS categoria,
  r.camiseta,
  r.camiseta_modelo,
  r.bib_number,
  r.status,
  pl.nome         AS lote,
  pl.preco_centavos,
  p.metodo        AS pagamento,
  p.status        AS pag_status,
  p.paid_at,
  r.created_at,
  r.comprovante_url
FROM registration r
JOIN athlete      a  ON r.athlete_id = a.id
JOIN race         rc ON r.race_id    = rc.id
JOIN pricing_lot  pl ON r.lot_id     = pl.id
LEFT JOIN payment p  ON p.registration_id = r.id
ORDER BY r.created_at DESC;

-- Re-concede permissões
GRANT SELECT ON vw_inscritos TO anon;
GRANT SELECT ON vw_inscritos TO authenticated;
