-- migrations/032_kids_sem_camiseta_e_receita_zero.sql
-- INO RUN 2026 — Suporte à inscrição Kids GRATUITA e SEM CAMISETA.
--   1. registration.camiseta e camiseta_modelo passam a aceitar NULL (Kids não tem camiseta).
--   2. Trigger financeiro não lança receita/despesa de valor 0 (evita violar CHECK valor > 0).
-- Executar manualmente no Supabase SQL Editor.

-- ══════════════════════════════════════════════════════════════
-- 1. camiseta / camiseta_modelo podem ser NULL
-- ══════════════════════════════════════════════════════════════
ALTER TABLE registration ALTER COLUMN camiseta        DROP NOT NULL;
ALTER TABLE registration ALTER COLUMN camiseta_modelo DROP NOT NULL;

-- ══════════════════════════════════════════════════════════════
-- 2. Trigger financeiro: só lança entradas com valor > 0
--    (Kids gratuito: inscrição R$0 não gera receita; a taxa R$5 continua
--     gerando a despesa normalmente.)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION fn_auto_financial_receita()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event_id uuid;
  v_descricao_receita text;
  v_descricao_taxa    text;
BEGIN
  IF NEW.status = 'pago' AND (OLD.status IS DISTINCT FROM 'pago') THEN
    SELECT r.event_id INTO v_event_id
    FROM registration r WHERE r.id = NEW.registration_id;

    v_descricao_receita := 'Inscrição confirmada · Pag. ' || NEW.metodo;
    v_descricao_taxa    := 'Taxa de plataforma · Pag. ' || NEW.metodo;

    -- (a) Receita da inscrição — só se houver valor (Kids gratuito = R$0)
    IF NEW.valor_centavos > 0 THEN
      INSERT INTO financial_entry
        (evento_id, tipo, categoria, descricao, valor_centavos, automatico, referencia)
      VALUES
        (v_event_id, 'receita', 'inscricao',
         v_descricao_receita, NEW.valor_centavos, true, NEW.id);
    END IF;

    -- (b) Despesa da taxa de plataforma — só se houver taxa
    IF COALESCE(NEW.taxa_plataforma_centavos, 0) > 0 THEN
      INSERT INTO financial_entry
        (evento_id, tipo, categoria, descricao, valor_centavos, automatico, referencia)
      VALUES
        (v_event_id, 'despesa', 'taxa_plataforma',
         v_descricao_taxa, NEW.taxa_plataforma_centavos, true, NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_financial ON payment;
CREATE TRIGGER trg_auto_financial
  AFTER UPDATE ON payment
  FOR EACH ROW EXECUTE FUNCTION fn_auto_financial_receita();

-- ══════════════════════════════════════════════════════════════
-- VERIFICAÇÃO
-- ══════════════════════════════════════════════════════════════
-- SELECT column_name, is_nullable FROM information_schema.columns
-- WHERE table_name = 'registration' AND column_name IN ('camiseta','camiseta_modelo');
