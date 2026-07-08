-- migrations/030_excluir_inscricoes_canceladas.sql
-- INO RUN 2026 — Remove inscrições com status 'cancelado' do banco.
-- ⚠️  IRREVERSÍVEL. Execute PRIMEIRO o bloco de verificação antes do DELETE.
-- Executar manualmente no Supabase SQL Editor.

-- ══════════════════════════════════════════════════════════════
-- PASSO 1 — VERIFICAÇÃO (execute e confira os registros)
-- ══════════════════════════════════════════════════════════════
SELECT
  r.id           AS registration_id,
  a.nome         AS atleta,
  a.email,
  rc.label       AS prova,
  r.status,
  r.created_at
FROM registration r
JOIN athlete  a  ON a.id  = r.athlete_id
JOIN race     rc ON rc.id = r.race_id
JOIN event    e  ON e.id  = r.event_id
WHERE r.status  = 'cancelado'
  AND e.slug    = 'inorun-2026'
ORDER BY r.created_at;

-- ══════════════════════════════════════════════════════════════
-- PASSO 2 — DELETAR pagamentos das inscrições canceladas
--           (registros dependentes devem ser removidos primeiro)
-- ══════════════════════════════════════════════════════════════
DELETE FROM payment
WHERE registration_id IN (
  SELECT r.id
  FROM registration r
  JOIN event e ON e.id = r.event_id
  WHERE r.status = 'cancelado'
    AND e.slug   = 'inorun-2026'
);

-- ══════════════════════════════════════════════════════════════
-- PASSO 3 — DELETAR as inscrições canceladas
-- ══════════════════════════════════════════════════════════════
DELETE FROM registration
WHERE id IN (
  SELECT r.id
  FROM registration r
  JOIN event e ON e.id = r.event_id
  WHERE r.status = 'cancelado'
    AND e.slug   = 'inorun-2026'
);

-- ══════════════════════════════════════════════════════════════
-- PASSO 4 — VERIFICAÇÃO FINAL (deve retornar 0 linhas)
-- ══════════════════════════════════════════════════════════════
SELECT COUNT(*) AS cancelados_restantes
FROM registration r
JOIN event e ON e.id = r.event_id
WHERE r.status = 'cancelado'
  AND e.slug   = 'inorun-2026';
