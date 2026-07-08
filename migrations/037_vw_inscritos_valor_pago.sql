-- migrations/037_vw_inscritos_valor_pago.sql
-- INO RUN 2026 — Expõe o valor efetivamente PAGO (payment.valor_centavos, já com
-- desconto de cupom) na vw_inscritos, para o Dashboard mostrar a receita real.
-- Recria a view completa (mantém telefone, camiseta_modelo, comprovante_url).
-- Executar manualmente no Supabase SQL Editor.

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
  p.valor_centavos           AS valor_pago,     -- valor da inscrição efetivamente pago (com desconto)
  p.taxa_plataforma_centavos AS taxa_paga,      -- taxa de plataforma paga
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

GRANT SELECT ON vw_inscritos TO anon;
GRANT SELECT ON vw_inscritos TO authenticated;

-- Verificação:
-- SELECT nome, status, preco_centavos, valor_pago FROM vw_inscritos WHERE status = 'confirmado';
