-- migrations/008_financeiro.sql
-- Controle financeiro do evento: receitas (inscrições, patrocínio, etc.) e despesas

CREATE TABLE IF NOT EXISTS financial_entry (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id   uuid REFERENCES event(id) ON DELETE CASCADE,
  tipo        text NOT NULL CHECK (tipo IN ('receita','despesa')),
  categoria   text NOT NULL,  -- 'inscricao'|'patrocinio'|'taxa_gateway'|'material'|'logistica'|'premiacao'|'outros'
  descricao   text NOT NULL,
  valor_centavos bigint NOT NULL CHECK (valor_centavos > 0),
  data_lancamento date NOT NULL DEFAULT CURRENT_DATE,
  automatico  bool NOT NULL DEFAULT false,  -- true = gerado pelo sistema (pagamentos confirmados)
  referencia  uuid DEFAULT NULL,  -- FK opcional para payment.id
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_entry_evento ON financial_entry(evento_id);
CREATE INDEX IF NOT EXISTS idx_financial_entry_tipo   ON financial_entry(tipo);

-- RLS
ALTER TABLE financial_entry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "financial_anon" ON financial_entry;
CREATE POLICY "financial_anon" ON financial_entry FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON financial_entry TO anon;

-- ── Triggers: lançamento automático ao confirmar pagamento ────────────────
CREATE OR REPLACE FUNCTION fn_auto_financial_receita()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event_id uuid;
  v_descricao text;
BEGIN
  -- Só dispara quando status muda para 'pago'
  IF NEW.status = 'pago' AND (OLD.status IS DISTINCT FROM 'pago') THEN
    SELECT r.event_id INTO v_event_id
    FROM registration r WHERE r.id = NEW.registration_id;

    v_descricao := 'Inscrição confirmada · Pag. ' || NEW.metodo;

    INSERT INTO financial_entry (evento_id, tipo, categoria, descricao, valor_centavos, automatico, referencia)
    VALUES (v_event_id, 'receita', 'inscricao', v_descricao, NEW.valor_centavos, true, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_financial ON payment;
CREATE TRIGGER trg_auto_financial
  AFTER UPDATE ON payment
  FOR EACH ROW EXECUTE FUNCTION fn_auto_financial_receita();

-- ── Função para lançar entrada manual ─────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_lancar_financeiro(
  p_evento_id    uuid,
  p_tipo         text,
  p_categoria    text,
  p_descricao    text,
  p_valor_cents  bigint,
  p_data         date DEFAULT CURRENT_DATE
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO financial_entry (evento_id, tipo, categoria, descricao, valor_centavos, data_lancamento, automatico)
  VALUES (p_evento_id, p_tipo, p_categoria, p_descricao, p_valor_cents, p_data, false)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_lancar_financeiro(uuid,text,text,text,bigint,date) TO anon;

-- ── Função para deletar lançamento manual ─────────────────────────────────
CREATE OR REPLACE FUNCTION admin_deletar_lancamento(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM financial_entry WHERE id = p_id AND automatico = false;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Lançamento não encontrado ou automático (não deletável)');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_deletar_lancamento(uuid) TO anon;
