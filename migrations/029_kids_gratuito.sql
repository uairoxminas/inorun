-- migrations/029_kids_gratuito.sql
-- INO RUN 2026 — Prova Kids: inscrição GRATUITA (R$0,00).
-- O atleta paga apenas a taxa de plataforma de R$5,00 (cobrada separadamente no frontend).
-- Executar manualmente no Supabase SQL Editor.

-- ══════════════════════════════════════════════════════════════
-- 1. LOTE ÚNICO DO KIDS → R$ 0,00 (gratuito)
-- ══════════════════════════════════════════════════════════════
UPDATE pricing_lot pl
SET preco_centavos = 0,
    nome           = 'Gratuito',
    abre_em        = '2026-01-01 00:00:00-03',
    fecha_em       = '2026-10-01 23:59:59-03'
FROM race r
JOIN event e ON r.event_id = e.id
WHERE pl.race_id = r.id
  AND e.slug    = 'inorun-2026'
  AND r.tipo    = 'kids';

-- ══════════════════════════════════════════════════════════════
-- 2. VERIFICAÇÃO — deve retornar preco_centavos = 0
-- ══════════════════════════════════════════════════════════════
SELECT r.label, pl.nome, pl.preco_centavos, pl.ordem, pl.abre_em, pl.fecha_em
FROM pricing_lot pl
JOIN race r ON pl.race_id = r.id
JOIN event e ON r.event_id = e.id
WHERE e.slug  = 'inorun-2026'
  AND r.tipo  = 'kids'
ORDER BY pl.ordem;
