-- migrations/002_schema_principal.sql
-- Phase 3 · Architect — Schema principal INO RUN 2026
-- Baseado no gemini.md (fonte da verdade)

-- ══════════════════════════════════════════════════════════════
-- TIPOS ENUM
-- ══════════════════════════════════════════════════════════════
DO $$ BEGIN
  CREATE TYPE sexo_tipo      AS ENUM ('M', 'F');
  CREATE TYPE camiseta_tipo  AS ENUM ('PP', 'P', 'M', 'G', 'GG', 'XG');
  CREATE TYPE reg_status     AS ENUM ('pendente', 'confirmado', 'cancelado');
  CREATE TYPE pag_metodo     AS ENUM ('pix', 'cartao');
  CREATE TYPE pag_status     AS ENUM ('criado', 'pago', 'falhou', 'estornado');
  CREATE TYPE cupom_tipo     AS ENUM ('percentual', 'fixo');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ══════════════════════════════════════════════════════════════
-- EVENT — Evento pai
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS event (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text    NOT NULL UNIQUE,
  nome       text    NOT NULL,
  cidade     text    NOT NULL,
  uf         char(2) NOT NULL,
  data_prova date    NOT NULL,
  status     text    NOT NULL DEFAULT 'ativo',
  created_at timestamptz DEFAULT now()
);

INSERT INTO event (slug, nome, cidade, uf, data_prova, status)
VALUES ('inorun-2026', 'INO RUN 2026 — Corrida InoLive', 'Paraopeba', 'MG', '2026-10-11', 'ativo')
ON CONFLICT (slug) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- RACE — Provas do evento
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS race (
  id             uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid  NOT NULL REFERENCES event(id),
  distancia_km   int   NOT NULL,
  label          text  NOT NULL,
  descricao      text,
  vagas_total    int   NOT NULL DEFAULT 500,
  created_at     timestamptz DEFAULT now()
);

INSERT INTO race (event_id, distancia_km, label, descricao, vagas_total)
SELECT
  e.id,
  prova.distancia_km,
  prova.label,
  prova.descricao,
  prova.vagas
FROM event e, (VALUES
  (5,  'Prova 5 km',  'Percurso rápido e dinâmico. Ideal para iniciantes que buscam bem-estar e a energia da linha de chegada.',   280),
  (10, 'Prova 10 km', 'Percurso desafiador para performance. Para atletas que buscam quebrar recordes pessoais e elevar o nível.', 160)
) AS prova(distancia_km, label, descricao, vagas)
WHERE e.slug = 'inorun-2026'
ON CONFLICT DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- PRICING_LOT — Lotes de preço (fonte: gemini.md)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS pricing_lot (
  id              uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id         uuid  NOT NULL REFERENCES race(id),
  nome            text  NOT NULL,
  preco_centavos  int   NOT NULL,
  abre_em         timestamptz NOT NULL,
  fecha_em        timestamptz NOT NULL,
  ordem           int   NOT NULL,
  created_at      timestamptz DEFAULT now()
);

-- 5 km: Lote 1=7900, Lote 2=8900, Lote 3=9900
INSERT INTO pricing_lot (race_id, nome, preco_centavos, abre_em, fecha_em, ordem)
SELECT
  r.id,
  lote.nome,
  lote.preco_centavos,
  lote.abre_em::timestamptz,
  lote.fecha_em::timestamptz,
  lote.ordem
FROM race r
JOIN event e ON r.event_id = e.id
, (VALUES
  ('Lote 1', 7900, '2026-01-01 00:00:00-03', '2026-07-31 23:59:59-03', 1),
  ('Lote 2', 8900, '2026-08-01 00:00:00-03', '2026-09-30 23:59:59-03', 2),
  ('Lote 3', 9900, '2026-10-01 00:00:00-03', '2026-10-10 23:59:59-03', 3)
) AS lote(nome, preco_centavos, abre_em, fecha_em, ordem)
WHERE e.slug = 'inorun-2026' AND r.distancia_km = 5
ON CONFLICT DO NOTHING;

-- 10 km: Lote 1=9900, Lote 2=10900, Lote 3=11900
INSERT INTO pricing_lot (race_id, nome, preco_centavos, abre_em, fecha_em, ordem)
SELECT
  r.id,
  lote.nome,
  lote.preco_centavos,
  lote.abre_em::timestamptz,
  lote.fecha_em::timestamptz,
  lote.ordem
FROM race r
JOIN event e ON r.event_id = e.id
, (VALUES
  ('Lote 1',  9900, '2026-01-01 00:00:00-03', '2026-07-31 23:59:59-03', 1),
  ('Lote 2', 10900, '2026-08-01 00:00:00-03', '2026-09-30 23:59:59-03', 2),
  ('Lote 3', 11900, '2026-10-01 00:00:00-03', '2026-10-10 23:59:59-03', 3)
) AS lote(nome, preco_centavos, abre_em, fecha_em, ordem)
WHERE e.slug = 'inorun-2026' AND r.distancia_km = 10
ON CONFLICT DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- ATHLETE — Atleta (dados pessoais LGPD)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS athlete (
  id                 uuid       PRIMARY KEY DEFAULT gen_random_uuid(),
  nome               text       NOT NULL,
  cpf                text       NOT NULL UNIQUE,
  nascimento         date       NOT NULL,
  sexo               sexo_tipo  NOT NULL,
  email              text       NOT NULL,
  telefone           text,
  contato_emergencia text,
  created_at         timestamptz DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- COUPON — Cupons de desconto
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS coupon (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo    text        NOT NULL UNIQUE,
  tipo      cupom_tipo  NOT NULL DEFAULT 'percentual',
  valor     numeric(10,2) NOT NULL,  -- ex: 10.00 = 10%
  ativo     boolean     NOT NULL DEFAULT true,
  validade  timestamptz,
  created_at timestamptz DEFAULT now()
);

INSERT INTO coupon (codigo, tipo, valor, ativo, validade)
VALUES ('INO10', 'percentual', 10.00, true, '2026-10-10 23:59:59-03')
ON CONFLICT (codigo) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- REGISTRATION — Inscrição
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS registration (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid          NOT NULL REFERENCES event(id),
  race_id     uuid          NOT NULL REFERENCES race(id),
  athlete_id  uuid          NOT NULL REFERENCES athlete(id),
  lot_id      uuid          NOT NULL REFERENCES pricing_lot(id),
  category_id text          NOT NULL,  -- ex: "M 30-34" (derivado, não FK)
  camiseta    camiseta_tipo NOT NULL,
  cupom_id    uuid          REFERENCES coupon(id),
  bib_number  int           UNIQUE,    -- gerado após pagamento confirmado
  status      reg_status    NOT NULL DEFAULT 'pendente',
  created_at  timestamptz   DEFAULT now(),
  -- Invariante: CPF único por prova (race_id)
  UNIQUE (race_id, athlete_id)
);

-- ══════════════════════════════════════════════════════════════
-- PAYMENT — Pagamento
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS payment (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id   uuid        NOT NULL REFERENCES registration(id),
  gateway           text        NOT NULL DEFAULT 'mock',
  metodo            pag_metodo  NOT NULL,
  valor_centavos    int         NOT NULL,
  status            pag_status  NOT NULL DEFAULT 'criado',
  gateway_ref       text        UNIQUE,  -- idempotência: mesmo ref não confirma 2x
  paid_at           timestamptz,
  created_at        timestamptz DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- FUNÇÃO: confirmar_pagamento (webhook handler)
-- Invariantes: idempotência, bib sequencial, status atômico
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION confirmar_pagamento(
  p_gateway_ref  text,
  p_paid_at      timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment       payment%ROWTYPE;
  v_registration  registration%ROWTYPE;
  v_bib           int;
BEGIN
  -- Busca o pagamento pelo gateway_ref
  SELECT * INTO v_payment FROM payment WHERE gateway_ref = p_gateway_ref;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'payment_not_found', 'gateway_ref', p_gateway_ref);
  END IF;

  -- Idempotência: se já foi pago, retorna sucesso sem re-processar
  IF v_payment.status = 'pago' THEN
    SELECT * INTO v_registration FROM registration WHERE id = v_payment.registration_id;
    RETURN jsonb_build_object('ok', true, 'idempotente', true, 'bib_number', v_registration.bib_number);
  END IF;

  -- Gera bib_number sequencial por evento (sem buracos)
  SELECT COALESCE(MAX(r.bib_number), 999) + 1
  INTO v_bib
  FROM registration r
  JOIN race rc ON r.race_id = rc.id
  JOIN event e ON rc.event_id = e.id
  WHERE e.id = (
    SELECT rc2.event_id FROM race rc2
    JOIN registration r2 ON r2.race_id = rc2.id
    WHERE r2.id = v_payment.registration_id
  );

  -- Atualiza pagamento → pago
  UPDATE payment
  SET status = 'pago', paid_at = p_paid_at
  WHERE id = v_payment.id;

  -- Atualiza inscrição → confirmada + bib
  UPDATE registration
  SET status = 'confirmado', bib_number = v_bib
  WHERE id = v_payment.registration_id
  RETURNING * INTO v_registration;

  RETURN jsonb_build_object(
    'ok',           true,
    'bib_number',   v_bib,
    'registration', row_to_json(v_registration)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION confirmar_pagamento(text, timestamptz) TO service_role;

-- ══════════════════════════════════════════════════════════════
-- RLS — Row Level Security
-- ══════════════════════════════════════════════════════════════

-- event: leitura pública
ALTER TABLE event ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_public_read" ON event;
CREATE POLICY "event_public_read" ON event FOR SELECT TO anon USING (true);

-- race: leitura pública
ALTER TABLE race ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "race_public_read" ON race;
CREATE POLICY "race_public_read" ON race FOR SELECT TO anon USING (true);

-- pricing_lot: leitura pública
ALTER TABLE pricing_lot ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lot_public_read" ON pricing_lot;
CREATE POLICY "lot_public_read" ON pricing_lot FOR SELECT TO anon USING (true);

-- coupon: apenas service_role (não expõe cupons pela API pública)
ALTER TABLE coupon ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coupon_service" ON coupon;
CREATE POLICY "coupon_service" ON coupon FOR ALL TO service_role USING (true) WITH CHECK (true);

-- athlete: protegido por RLS — cada atleta acessa só seus dados
ALTER TABLE athlete ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "athlete_service" ON athlete;
CREATE POLICY "athlete_service" ON athlete FOR ALL TO service_role USING (true) WITH CHECK (true);

-- registration: service_role acessa tudo; anon insere (fluxo de inscrição)
ALTER TABLE registration ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reg_service"    ON registration;
DROP POLICY IF EXISTS "reg_anon_insert" ON registration;
CREATE POLICY "reg_service"     ON registration FOR ALL    TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "reg_anon_insert" ON registration FOR INSERT TO anon         WITH CHECK (true);

-- payment: apenas service_role
ALTER TABLE payment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pay_service" ON payment;
CREATE POLICY "pay_service" ON payment FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════
-- VIEWS auxiliares (sem RLS — usadas apenas pelo service_role)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW vw_inscritos AS
SELECT
  r.id            AS registration_id,
  a.nome,
  a.email,
  a.cpf,
  a.sexo,
  rc.distancia_km AS distancia,
  rc.label        AS prova,
  r.category_id   AS categoria,
  r.camiseta,
  r.bib_number,
  r.status,
  pl.nome         AS lote,
  pl.preco_centavos,
  p.metodo        AS pagamento,
  p.status        AS pag_status,
  p.paid_at,
  r.created_at
FROM registration r
JOIN athlete      a  ON r.athlete_id = a.id
JOIN race         rc ON r.race_id    = rc.id
JOIN pricing_lot  pl ON r.lot_id     = pl.id
LEFT JOIN payment p  ON p.registration_id = r.id
ORDER BY r.created_at DESC;
