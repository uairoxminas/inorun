-- migrations/014_taxa_plataforma.sql
-- INO RUN 2026 — Taxa de plataforma R$5,00 por inscrição (Opção B)
-- Campo separado na tabela payment: valor_centavos (líquido) + taxa_plataforma_centavos (R$5)
-- Executar manualmente no Supabase SQL Editor

-- ══════════════════════════════════════════════════════════════
-- 1. ADICIONAR COLUNA taxa_plataforma_centavos NA TABELA payment
-- ══════════════════════════════════════════════════════════════
ALTER TABLE payment
  ADD COLUMN IF NOT EXISTS taxa_plataforma_centavos int NOT NULL DEFAULT 500;

-- Comentário: DEFAULT 500 = R$5,00 por inscrição (fixo para todas as modalidades)

-- ══════════════════════════════════════════════════════════════
-- 2. ADICIONAR CATEGORIA taxa_plataforma AO financial_entry
-- ══════════════════════════════════════════════════════════════
-- (A constraint de categoria é CHECK TEXT, não enum — já aceita qualquer string)
-- Apenas confirmar que o label está no CAT_LABEL do front (já está como 'taxa_gateway').
-- Usaremos 'taxa_plataforma' como categoria própria para separar da taxa do gateway de pagamento.

-- ══════════════════════════════════════════════════════════════
-- 3. ATUALIZAR TRIGGER para lançar DOIS registros no financeiro:
--    (a) Receita da inscrição (valor líquido)
--    (b) Despesa da taxa de plataforma
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION fn_auto_financial_receita()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event_id uuid;
  v_descricao_receita text;
  v_descricao_taxa    text;
BEGIN
  -- Só dispara quando status muda para 'pago'
  IF NEW.status = 'pago' AND (OLD.status IS DISTINCT FROM 'pago') THEN
    SELECT r.event_id INTO v_event_id
    FROM registration r WHERE r.id = NEW.registration_id;

    v_descricao_receita := 'Inscrição confirmada · Pag. ' || NEW.metodo;
    v_descricao_taxa    := 'Taxa de plataforma · Pag. ' || NEW.metodo;

    -- (a) Receita da inscrição (valor líquido — sem a taxa)
    INSERT INTO financial_entry
      (evento_id, tipo, categoria, descricao, valor_centavos, automatico, referencia)
    VALUES
      (v_event_id, 'receita', 'inscricao',
       v_descricao_receita, NEW.valor_centavos, true, NEW.id);

    -- (b) Despesa da taxa de plataforma (R$5,00 por inscrição)
    INSERT INTO financial_entry
      (evento_id, tipo, categoria, descricao, valor_centavos, automatico, referencia)
    VALUES
      (v_event_id, 'despesa', 'taxa_plataforma',
       v_descricao_taxa, NEW.taxa_plataforma_centavos, true, NEW.id);

  END IF;
  RETURN NEW;
END;
$$;

-- Recriar o trigger (a função foi substituída com CREATE OR REPLACE)
DROP TRIGGER IF EXISTS trg_auto_financial ON payment;
CREATE TRIGGER trg_auto_financial
  AFTER UPDATE ON payment
  FOR EACH ROW EXECUTE FUNCTION fn_auto_financial_receita();

-- ══════════════════════════════════════════════════════════════
-- VERIFICAÇÃO
-- ══════════════════════════════════════════════════════════════
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'payment' AND column_name = 'taxa_plataforma_centavos';
