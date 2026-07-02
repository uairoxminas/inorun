-- migrations/024_inscricao_grupo.sql
-- INO RUN 2026 — Inscrição em grupo (assessorias/equipes): a partir de 10 atletas,
-- cada inscrição por R$89,00 (+ R$5 taxa por cima). 1 PIX consolidado, admin confirma o grupo.
-- Executar manualmente no Supabase SQL Editor.

-- ══════════════════════════════════════════════════════════════
-- 0. CONSTANTES DE NEGÓCIO
--    Preço de grupo: 8900 centavos (R$89). Taxa: 500 (R$5). Mínimo: 10 atletas.
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- 1. STATUS 'em_analise' JÁ EXISTE (migration 017). Nada a fazer aqui.
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- 2. TABELA registration_group
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS registration_group (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id               uuid NOT NULL REFERENCES event(id),
  nome_grupo             text NOT NULL,
  responsavel_nome       text NOT NULL,
  responsavel_email      text NOT NULL,
  responsavel_telefone   text,
  qtd_atletas            int  NOT NULL DEFAULT 0,
  preco_unitario_centavos int NOT NULL DEFAULT 8900,
  taxa_unitaria_centavos  int NOT NULL DEFAULT 500,
  valor_total_centavos    int NOT NULL DEFAULT 0,
  status                 text NOT NULL DEFAULT 'pendente', -- pendente | em_analise | confirmado | cancelado
  comprovante_url        text,
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- Coluna group_id em registration (liga inscrição ao grupo)
ALTER TABLE registration
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES registration_group(id);

CREATE INDEX IF NOT EXISTS idx_registration_group_id ON registration(group_id);

-- RLS: acesso liberado ao anon (mesmo padrão do restante do painel).
-- A segurança real fica nas RPCs SECURITY DEFINER + gate de sessão do admin.
ALTER TABLE registration_group ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reg_group_anon" ON registration_group;
CREATE POLICY "reg_group_anon" ON registration_group FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON registration_group TO anon;

-- ══════════════════════════════════════════════════════════════
-- 3. LOTE ESPECIAL "Grupo (10+)" POR PROVA
--    Preço R$89. Datas no passado → NUNCA fica ativo no fluxo individual
--    (getLoteAtivo filtra por data). Serve só como referência de preço/FK.
-- ══════════════════════════════════════════════════════════════
INSERT INTO pricing_lot (race_id, nome, preco_centavos, abre_em, fecha_em, ordem)
SELECT r.id, 'Grupo (10+)', 8900,
       '2000-01-01 00:00:00-03', '2000-01-01 00:00:00-03', 99
FROM race r
JOIN event e ON r.event_id = e.id
WHERE e.slug = 'inorun-2026'
  AND NOT EXISTS (
    SELECT 1 FROM pricing_lot pl
    WHERE pl.race_id = r.id AND pl.nome = 'Grupo (10+)'
  );

-- ══════════════════════════════════════════════════════════════
-- 4. RPC: criar_inscricao_grupo
--    Cria grupo + atletas + inscrições (pendente) + pagamentos (criado).
--    Atômico: se um CPF já está inscrito na prova, tudo é revertido.
--    p_grupo:   { nome_grupo, responsavel_nome, responsavel_email, responsavel_telefone }
--    p_atletas: [ { nome, cpf, nascimento, sexo, email, telefone, camiseta, race_id, categoria } ]
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION criar_inscricao_grupo(
  p_grupo   jsonb,
  p_atletas jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id   uuid;
  v_group_id   uuid;
  v_qtd        int;
  v_idx        int := 0;
  v_atleta     jsonb;
  v_athlete_id uuid;
  v_lot_id     uuid;
  v_reg_id     uuid;
  v_upsert     jsonb;
  v_preco      int := 8900;
  v_taxa       int := 500;
BEGIN
  v_qtd := jsonb_array_length(p_atletas);
  IF v_qtd IS NULL OR v_qtd < 10 THEN
    RETURN jsonb_build_object('error', 'Grupo exige no mínimo 10 atletas.');
  END IF;

  SELECT id INTO v_event_id FROM event WHERE slug = 'inorun-2026';
  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Evento não encontrado.');
  END IF;

  -- Cria o grupo
  INSERT INTO registration_group (
    event_id, nome_grupo, responsavel_nome, responsavel_email, responsavel_telefone,
    qtd_atletas, preco_unitario_centavos, taxa_unitaria_centavos, valor_total_centavos, status
  ) VALUES (
    v_event_id,
    p_grupo->>'nome_grupo',
    p_grupo->>'responsavel_nome',
    p_grupo->>'responsavel_email',
    p_grupo->>'responsavel_telefone',
    v_qtd, v_preco, v_taxa, v_qtd * (v_preco + v_taxa), 'pendente'
  )
  RETURNING id INTO v_group_id;

  -- Cada atleta → athlete + registration + payment
  FOR v_atleta IN SELECT * FROM jsonb_array_elements(p_atletas)
  LOOP
    v_idx := v_idx + 1;

    -- upsert atleta (reusa a função existente)
    v_upsert := upsert_atleta(
      v_atleta->>'nome',
      regexp_replace(v_atleta->>'cpf', '\D', '', 'g'),
      (v_atleta->>'nascimento')::date,
      (v_atleta->>'sexo')::sexo_tipo,
      lower(trim(v_atleta->>'email')),
      NULLIF(trim(v_atleta->>'telefone'), ''),
      NULL
    );
    IF v_upsert ? 'error' THEN
      RAISE EXCEPTION 'Atleta % (%): %', v_idx, v_atleta->>'nome', v_upsert->>'error';
    END IF;
    v_athlete_id := (v_upsert->>'athlete_id')::uuid;

    -- lote "Grupo (10+)" da prova escolhida
    SELECT id INTO v_lot_id
    FROM pricing_lot
    WHERE race_id = (v_atleta->>'race_id')::uuid AND nome = 'Grupo (10+)'
    LIMIT 1;
    IF v_lot_id IS NULL THEN
      RAISE EXCEPTION 'Prova sem lote de grupo configurado (atleta %).', v_atleta->>'nome';
    END IF;

    -- inscrição
    BEGIN
      INSERT INTO registration (
        event_id, race_id, athlete_id, lot_id, category_id, camiseta, status, group_id
      ) VALUES (
        v_event_id,
        (v_atleta->>'race_id')::uuid,
        v_athlete_id,
        v_lot_id,
        v_atleta->>'categoria',
        (v_atleta->>'camiseta')::camiseta_tipo,
        'pendente'::reg_status,
        v_group_id
      )
      RETURNING id INTO v_reg_id;
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'O CPF do atleta "%" já está inscrito nesta prova.', v_atleta->>'nome';
    END;

    -- pagamento (parte do PIX consolidado do grupo)
    INSERT INTO payment (
      registration_id, gateway, metodo, valor_centavos, taxa_plataforma_centavos, status, gateway_ref
    ) VALUES (
      v_reg_id, 'pix_grupo', 'pix'::pag_metodo, v_preco, v_taxa, 'criado'::pag_status,
      'grupo_' || v_group_id::text || '_' || v_idx::text
    );
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'group_id', v_group_id,
    'qtd_atletas', v_qtd,
    'valor_total_centavos', v_qtd * (v_preco + v_taxa)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION criar_inscricao_grupo(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION criar_inscricao_grupo(jsonb, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION criar_inscricao_grupo(jsonb, jsonb) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- 5. RPC: registrar_comprovante_grupo
--    Salva a URL do comprovante e move o grupo para 'em_analise'.
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION registrar_comprovante_grupo(
  p_group_id uuid,
  p_url      text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE registration_group
  SET comprovante_url = p_url,
      status = 'em_analise'
  WHERE id = p_group_id
    AND status IN ('pendente', 'em_analise');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Grupo não encontrado ou já processado.');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION registrar_comprovante_grupo(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION registrar_comprovante_grupo(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION registrar_comprovante_grupo(uuid, text) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- 6. RPC: confirmar_grupo (admin)
--    'confirmar': gera bib sequencial p/ cada atleta, confirma inscrições
--     e marca os pagamentos como 'pago' (dispara receita no Financeiro).
--    'rejeitar': cancela grupo, inscrições e pagamentos.
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION confirmar_grupo(
  p_group_id uuid,
  p_acao     text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id uuid;
  v_reg      RECORD;
  v_bib      int;
  v_count    int := 0;
BEGIN
  SELECT event_id INTO v_event_id FROM registration_group WHERE id = p_group_id;
  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Grupo não encontrado.');
  END IF;

  IF p_acao = 'confirmar' THEN
    FOR v_reg IN
      SELECT id FROM registration
      WHERE group_id = p_group_id
        AND status::text IN ('pendente', 'em_analise')
      ORDER BY created_at
    LOOP
      SELECT COALESCE(MAX(bib_number), 0) + 1 INTO v_bib
      FROM registration
      WHERE event_id = v_event_id AND status::text = 'confirmado';

      UPDATE registration
      SET status = 'confirmado'::reg_status, bib_number = v_bib
      WHERE id = v_reg.id;

      UPDATE payment
      SET status = 'pago'::pag_status, paid_at = now()
      WHERE registration_id = v_reg.id AND status <> 'pago'::pag_status;

      v_count := v_count + 1;
    END LOOP;

    UPDATE registration_group SET status = 'confirmado' WHERE id = p_group_id;

    RETURN jsonb_build_object('ok', true, 'confirmados', v_count);

  ELSIF p_acao = 'rejeitar' THEN
    UPDATE payment p
    SET status = 'falhou'::pag_status
    FROM registration r
    WHERE p.registration_id = r.id AND r.group_id = p_group_id;

    UPDATE registration
    SET status = 'cancelado'::reg_status
    WHERE group_id = p_group_id AND status::text <> 'confirmado';

    UPDATE registration_group SET status = 'cancelado' WHERE id = p_group_id;

    RETURN jsonb_build_object('ok', true);

  ELSE
    RETURN jsonb_build_object('error', 'Ação inválida.');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION confirmar_grupo(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirmar_grupo(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION confirmar_grupo(uuid, text) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- 7. VIEWS para o painel admin
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW vw_grupos AS
SELECT
  g.id,
  g.nome_grupo,
  g.responsavel_nome,
  g.responsavel_email,
  g.responsavel_telefone,
  g.qtd_atletas,
  g.preco_unitario_centavos,
  g.taxa_unitaria_centavos,
  g.valor_total_centavos,
  g.status,
  g.comprovante_url,
  g.created_at,
  COUNT(r.id) FILTER (WHERE r.status::text = 'confirmado') AS confirmados
FROM registration_group g
LEFT JOIN registration r ON r.group_id = g.id
GROUP BY g.id
ORDER BY g.created_at DESC;

GRANT SELECT ON vw_grupos TO anon;
GRANT SELECT ON vw_grupos TO authenticated;

-- Atletas de um grupo (para o admin expandir)
CREATE OR REPLACE VIEW vw_grupo_atletas AS
SELECT
  r.group_id,
  r.id            AS registration_id,
  a.nome,
  a.cpf,
  a.email,
  a.sexo,
  rc.label        AS prova,
  rc.distancia_km,
  r.category_id   AS categoria,
  r.camiseta,
  r.bib_number,
  r.status
FROM registration r
JOIN athlete a  ON a.id  = r.athlete_id
JOIN race    rc ON rc.id = r.race_id
WHERE r.group_id IS NOT NULL
ORDER BY a.nome;

GRANT SELECT ON vw_grupo_atletas TO anon;
GRANT SELECT ON vw_grupo_atletas TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- VERIFICAÇÃO
-- ══════════════════════════════════════════════════════════════
-- SELECT * FROM vw_grupos;
-- SELECT * FROM vw_grupo_atletas WHERE group_id = '...';
