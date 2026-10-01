-- migrations/039_lote_ultima_chamada.sql
-- INO RUN 2026 — Lote "Última Chamada": R$119, de 02/10 até 10/10/2026.
-- Aplica a 5km, 10km e Caminhada (mesma lógica da migration 023).
-- Kids segue gratuito, estendido até 10/10/2026.
--
-- Regra do kit (aplicada no frontend — ver src/lib/ultimaChamada.ts):
--   inscrições até 05/10      → com camisa e plaquinha personalizada
--   inscrições de 06/10 a 10/10 → sem camisa e sem plaquinha (registration.camiseta = NULL)
-- Inscrição em grupo encerra em 05/10 (bloqueio no frontend; o lote "Grupo (10+)" não muda).

-- ══════════════════════════════════════════════════════════════
-- 1. LOTE ÚLTIMA CHAMADA (R$119) — corrida 5km/10km e Caminhada · 02/10 até 10/10/2026
-- ══════════════════════════════════════════════════════════════
INSERT INTO pricing_lot (race_id, nome, preco_centavos, abre_em, fecha_em, ordem)
SELECT r.id, 'Última Chamada', 11900,
       '2026-10-02 00:00:00-03', '2026-10-10 23:59:59-03', 3
FROM race r
JOIN event e ON r.event_id = e.id
WHERE e.slug = 'inorun-2026'
  AND r.tipo IN ('corrida', 'caminhada')
  AND NOT EXISTS (
    SELECT 1 FROM pricing_lot pl
    WHERE pl.race_id = r.id AND pl.nome = 'Última Chamada'
  );

-- ══════════════════════════════════════════════════════════════
-- 2. KIDS — segue gratuito, inscrições estendidas até 10/10/2026
-- ══════════════════════════════════════════════════════════════
UPDATE pricing_lot pl
SET fecha_em = '2026-10-10 23:59:59-03'
FROM race r
JOIN event e ON r.event_id = e.id
WHERE pl.race_id = r.id
  AND e.slug  = 'inorun-2026'
  AND r.tipo  = 'kids'
  AND pl.ordem = 1;

-- ══════════════════════════════════════════════════════════════
-- VERIFICAÇÃO
-- ══════════════════════════════════════════════════════════════
-- SELECT r.label, pl.nome, pl.preco_centavos, pl.ordem, pl.abre_em, pl.fecha_em
-- FROM pricing_lot pl JOIN race r ON pl.race_id = r.id
-- ORDER BY r.distancia_km, pl.ordem;
