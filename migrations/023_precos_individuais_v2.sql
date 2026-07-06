-- migrations/023_precos_individuais_v2.sql
-- INO RUN 2026 — Novo preço individual: Lote 1 = R$99, Lote 2 = R$109, sem Lote 3.
-- Aplica a 5km, 10km E Caminhada (mesma lógica e preços).
-- Lote 1 até 15/08/2026, Lote 2 de 16/08 até 01/10/2026 (encerra tudo em 01/10).
-- Kids NÃO é alterado aqui (ver migration 027). Executar manualmente no Supabase SQL Editor.

-- ══════════════════════════════════════════════════════════════
-- 1. LOTE 1 (R$99) — corrida 5km/10km e Caminhada · até 15/08/2026
-- ══════════════════════════════════════════════════════════════
UPDATE pricing_lot pl
SET preco_centavos = 9900,
    abre_em        = '2026-01-01 00:00:00-03',
    fecha_em       = '2026-08-15 23:59:59-03'
FROM race r
JOIN event e ON r.event_id = e.id
WHERE pl.race_id = r.id
  AND e.slug = 'inorun-2026'
  AND r.tipo IN ('corrida', 'caminhada')
  AND pl.ordem = 1;

-- ══════════════════════════════════════════════════════════════
-- 2. LOTE 2 (R$109) — corrida 5km/10km e Caminhada · 16/08 até 01/10/2026
-- ══════════════════════════════════════════════════════════════
UPDATE pricing_lot pl
SET preco_centavos = 10900,
    abre_em        = '2026-08-16 00:00:00-03',
    fecha_em       = '2026-10-01 23:59:59-03'
FROM race r
JOIN event e ON r.event_id = e.id
WHERE pl.race_id = r.id
  AND e.slug = 'inorun-2026'
  AND r.tipo IN ('corrida', 'caminhada')
  AND pl.ordem = 2;

-- ══════════════════════════════════════════════════════════════
-- 3. REMOVER LOTE 3 (não haverá terceiro lote)
--    Só deleta se nenhuma inscrição referencia o lote (seguro:
--    o Lote 3 abria só em 01/10, não deve ter uso). Se houver
--    referência, apenas fecha o lote (fecha_em no passado).
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
      AND r.tipo IN ('corrida', 'caminhada')
      AND pl.ordem = 3
  LOOP
    IF EXISTS (SELECT 1 FROM registration WHERE lot_id = v_lote.id) THEN
      -- Há inscrições: não deleta, apenas fecha (nunca mais fica ativo)
      UPDATE pricing_lot
      SET fecha_em = '2000-01-01 00:00:00-03'
      WHERE id = v_lote.id;
    ELSE
      DELETE FROM pricing_lot WHERE id = v_lote.id;
    END IF;
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════
-- VERIFICAÇÃO
-- ══════════════════════════════════════════════════════════════
-- SELECT r.label, r.distancia_km, pl.nome, pl.preco_centavos, pl.ordem, pl.abre_em, pl.fecha_em
-- FROM pricing_lot pl JOIN race r ON pl.race_id = r.id
-- ORDER BY r.distancia_km, pl.ordem;
