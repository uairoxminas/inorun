-- migrations/038_fix_comprovante_url_vw_inscritos.sql
-- INO RUN 2026 — Correção de comprovante_url nulo e exibição de inscrições pendentes com comprovante.
-- Executar no Supabase SQL Editor.

-- 1. Copia comprovantes salvos em pix_receipt para registration retroativamente
UPDATE registration r
SET comprovante_url = pr.comprovante_url
FROM pix_receipt pr
WHERE pr.registration_id = r.id 
  AND r.comprovante_url IS NULL 
  AND pr.comprovante_url IS NOT NULL;

-- 2. Recria a view vw_inscritos com COALESCE e dados da análise Gemini
DROP VIEW IF EXISTS vw_inscritos CASCADE;

CREATE VIEW vw_inscritos AS
SELECT
  r.id            AS registration_id,
  a.nome,
  a.email,
  a.cpf,
  a.sexo,
  a.telefone,
  rc.distancia_km AS distancia,
  rc.label        AS prova,
  r.category_id   AS categoria,
  r.camiseta,
  r.camiseta_modelo,
  r.bib_number,
  r.status,
  pl.nome         AS lote,
  pl.preco_centavos,
  p.valor_centavos           AS valor_pago,
  p.taxa_plataforma_centavos AS taxa_paga,
  p.metodo        AS pagamento,
  p.status        AS pag_status,
  p.paid_at,
  r.created_at,
  COALESCE(r.comprovante_url, pr.comprovante_url) AS comprovante_url,
  pr.gemini_motivo,
  pr.gemini_resultado
FROM registration r
JOIN athlete      a  ON r.athlete_id = a.id
JOIN race         rc ON r.race_id    = rc.id
JOIN pricing_lot  pl ON r.lot_id     = pl.id
LEFT JOIN payment p  ON p.registration_id = r.id
LEFT JOIN pix_receipt pr ON pr.registration_id = r.id
ORDER BY r.created_at DESC;

GRANT SELECT ON vw_inscritos TO anon;
GRANT SELECT ON vw_inscritos TO authenticated;
