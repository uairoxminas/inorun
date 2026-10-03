-- migrations/040_pedido_camisetas.sql
-- INO RUN 2026 — Controle de camisetas: pedidos enviados ao fornecedor e reserva técnica.
-- camiseta_pedido : cada envio ao fornecedor (lote de peças). O painel soma os envios
--                   para calcular o que já foi pedido e mostrar só o complemento.
-- camiseta_reserva: peças extras por modelo/tamanho (trocas, staff, cortesias).
-- Acesso segue o padrão das demais tabelas do painel (financial_entry, registration_group).

CREATE TABLE IF NOT EXISTS camiseta_pedido (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id   uuid NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  fornecedor  text,
  observacao  text,
  -- [{ "modelo": "unissex"|"babylook", "tamanho": "M", "quantidade": 12 }, ...]
  itens       jsonb NOT NULL,
  total       int  NOT NULL CHECK (total > 0),
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_camiseta_pedido_evento ON camiseta_pedido(evento_id);

CREATE TABLE IF NOT EXISTS camiseta_reserva (
  evento_id   uuid NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  modelo      text NOT NULL CHECK (modelo IN ('unissex','babylook')),
  tamanho     text NOT NULL,
  quantidade  int  NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  updated_at  timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (evento_id, modelo, tamanho)
);

-- RLS
ALTER TABLE camiseta_pedido  ENABLE ROW LEVEL SECURITY;
ALTER TABLE camiseta_reserva ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "camiseta_pedido_anon" ON camiseta_pedido;
CREATE POLICY "camiseta_pedido_anon" ON camiseta_pedido
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "camiseta_reserva_anon" ON camiseta_reserva;
CREATE POLICY "camiseta_reserva_anon" ON camiseta_reserva
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON camiseta_pedido  TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON camiseta_reserva TO anon, authenticated;
