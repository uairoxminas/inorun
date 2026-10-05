-- migrations/044_vw_inscritos_checkin_cupom_grupo.sql
-- INO RUN 2026 — vw_inscritos ganha checked_in_at, cupom (código) e grupo (nome do grupo),
-- usados na exportação em Excel do painel. Colunas novas no fim; as existentes não mudam.
-- Já aplicada em produção em 05/10/2026.

CREATE OR REPLACE VIEW vw_inscritos AS
 SELECT r.id AS registration_id,
    a.nome,
    a.email,
    a.cpf,
    a.sexo,
    a.telefone,
    rc.distancia_km AS distancia,
    rc.label AS prova,
    r.category_id AS categoria,
    r.camiseta,
    r.camiseta_modelo,
    r.bib_number,
    r.status,
    pl.nome AS lote,
    pl.preco_centavos,
    p.valor_centavos AS valor_pago,
    p.taxa_plataforma_centavos AS taxa_paga,
    p.metodo AS pagamento,
    p.status AS pag_status,
    p.paid_at,
    r.created_at,
    COALESCE(r.comprovante_url, pr.comprovante_url) AS comprovante_url,
    pr.gemini_motivo,
    pr.gemini_resultado,
    a.nascimento,
    a.contato_emergencia,
    r.race_id,
    r.checked_in_at,
    c.codigo AS cupom,
    g.nome_grupo AS grupo
   FROM registration r
     JOIN athlete a ON r.athlete_id = a.id
     JOIN race rc ON r.race_id = rc.id
     JOIN pricing_lot pl ON r.lot_id = pl.id
     LEFT JOIN payment p ON p.registration_id = r.id
     LEFT JOIN pix_receipt pr ON pr.registration_id = r.id
     LEFT JOIN coupon c ON c.id = r.cupom_id
     LEFT JOIN registration_group g ON g.id = r.group_id
  ORDER BY r.created_at DESC;
