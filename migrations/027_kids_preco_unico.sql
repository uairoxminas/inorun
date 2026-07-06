-- migrations/027_kids_preco_unico.sql
-- INO RUN 2026 — Corrida Kids: R$50,00, LOTE ÚNICO (sem alteração de lote).
-- Inscrições encerram 01/10 (igual às demais provas). Kids NÃO entra no grupo.
-- Executar manualmente no Supabase SQL Editor.

-- ══════════════════════════════════════════════════════════════
-- 1. LOTE ÚNICO DO KIDS → R$50, até 01/10/2026 (ordem 1)
-- ══════════════════════════════════════════════════════════════
UPDATE pricing_lot pl
SET preco_centavos = 5000,
    nome           = 'Lote único',
    abre_em        = '2026-01-01 00:00:00-03',
    fecha_em       = '2026-10-01 23:59:59-03'
FROM race r
JOIN event e ON r.event_id = e.id
WHERE pl.race_id = r.id
  AND e.slug = 'inorun-2026'
  AND r.tipo = 'kids'
  AND pl.ordem = 1;

-- ══════════════════════════════════════════════════════════════
-- 2. REMOVER LOTES EXTRAS DO KIDS (ordem 2 e 3) — lote único
--    Se algum estiver referenciado por inscrição, apenas fecha.
--    (Não mexe no lote especial "Grupo (10+)", ordem 99 — mas o
--     Kids também não será oferecido no fluxo de grupo.)
-- ══════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_lote RECORD;
BEGIN
  FOR v_lote IN
    SELECT pl.id
    FROM pricing_lot pl
    JOIN race  r ON pl.race_id = r.id
    JOIN event e ON r.event_id = e.id
    WHERE e.slug = 'inorun-2026'
      AND r.tipo = 'kids'
      AND pl.ordem IN (2, 3)
  LOOP
    IF EXISTS (SELECT 1 FROM registration WHERE lot_id = v_lote.id) THEN
      UPDATE pricing_lot SET fecha_em = '2000-01-01 00:00:00-03' WHERE id = v_lote.id;
    ELSE
      DELETE FROM pricing_lot WHERE id = v_lote.id;
    END IF;
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════
-- VERIFICAÇÃO
-- ══════════════════════════════════════════════════════════════
-- SELECT r.label, pl.nome, pl.preco_centavos, pl.ordem, pl.abre_em, pl.fecha_em
-- FROM pricing_lot pl JOIN race r ON pl.race_id = r.id
-- WHERE r.tipo = 'kids' ORDER BY pl.ordem;
