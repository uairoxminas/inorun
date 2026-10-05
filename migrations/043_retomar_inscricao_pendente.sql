-- migrations/043_retomar_inscricao_pendente.sql
-- INO RUN 2026 — Destrava quem refaz a inscrição.
-- Antes: CPF com inscrição pendente/cancelada na prova recebia "CPF já inscrito" (UNIQUE race_id+athlete_id)
-- e não conseguia corrigir cupom/camiseta nem voltar à tela do Pix.
-- Agora: o site chama esta função quando o INSERT em registration dá conflito. Ela reaproveita a
-- inscrição pendente ou cancelada (sem pagamento confirmado) com os dados novos e devolve o
-- gateway_ref para a tela do Pix. Confirmadas, em análise e de grupo continuam bloqueadas.

CREATE OR REPLACE FUNCTION retomar_inscricao_pendente(
  p_athlete_id       uuid,
  p_race_id          uuid,
  p_lot_id           uuid,
  p_categoria        text,
  p_camiseta         text,
  p_camiseta_modelo  text,
  p_cupom_id         uuid,
  p_valor_centavos   int,
  p_taxa_centavos    int
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reg  registration%ROWTYPE;
  v_pay  payment%ROWTYPE;
  v_ref  text;
BEGIN
  SELECT * INTO v_reg FROM registration
   WHERE athlete_id = p_athlete_id AND race_id = p_race_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Inscrição anterior não encontrada. Tente novamente.');
  END IF;

  IF v_reg.status::text = 'confirmado' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Este CPF já tem inscrição confirmada nesta prova. Não é preciso se inscrever de novo.');
  ELSIF v_reg.status::text = 'em_analise' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Já recebemos seu comprovante e ele está em análise. Aguarde a confirmação por e-mail.');
  ELSIF v_reg.group_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Este CPF faz parte de uma inscrição em grupo nesta prova. Fale com o responsável pelo grupo ou com o suporte.');
  END IF;

  IF p_valor_centavos < 0 OR p_taxa_centavos < 0
     OR NOT EXISTS (SELECT 1 FROM pricing_lot WHERE id = p_lot_id AND race_id = p_race_id) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Dados da inscrição inválidos. Recarregue a página e tente de novo.');
  END IF;

  SELECT * INTO v_pay FROM payment WHERE registration_id = v_reg.id ORDER BY created_at DESC LIMIT 1;
  IF FOUND AND v_pay.status <> 'criado'::pag_status THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Já existe um pagamento registrado para este CPF nesta prova. Fale com o suporte.');
  END IF;

  UPDATE registration SET
    status          = 'pendente'::reg_status,
    lot_id          = p_lot_id,
    category_id     = p_categoria,
    camiseta        = NULLIF(p_camiseta, '')::camiseta_tipo,
    camiseta_modelo = NULLIF(p_camiseta_modelo, ''),
    cupom_id        = p_cupom_id,
    comprovante_url = NULL,
    bib_number      = NULL
  WHERE id = v_reg.id;

  IF v_pay.id IS NOT NULL THEN
    UPDATE payment SET valor_centavos = p_valor_centavos, taxa_plataforma_centavos = p_taxa_centavos
     WHERE id = v_pay.id;
    v_ref := v_pay.gateway_ref;
  ELSE
    v_ref := 'pix_' || v_reg.id::text || '_' || (extract(epoch FROM clock_timestamp()) * 1000)::bigint::text;
    INSERT INTO payment (registration_id, gateway, metodo, valor_centavos, taxa_plataforma_centavos, status, gateway_ref)
    VALUES (v_reg.id, 'pix_manual', 'pix'::pag_metodo, p_valor_centavos, p_taxa_centavos, 'criado'::pag_status, v_ref);
  END IF;

  RETURN jsonb_build_object('ok', true, 'registration_id', v_reg.id, 'gateway_ref', v_ref);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION retomar_inscricao_pendente(uuid, uuid, uuid, text, text, text, uuid, int, int) TO anon, authenticated;
