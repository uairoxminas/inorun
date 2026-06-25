-- migrations/020_comprovante_url_registration.sql
-- Solucao definitiva: comprovante_url vai direto na tabela registration
-- Elimina dependencia de pix_receipt para exibicao no admin
-- Executar no Supabase SQL Editor

-- 1. Adiciona coluna comprovante_url na tabela registration
ALTER TABLE registration ADD COLUMN IF NOT EXISTS comprovante_url text;

-- 2. Atualiza vw_inscritos para incluir comprovante_url
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
  r.created_at,
  r.comprovante_url
FROM registration r
JOIN athlete      a  ON r.athlete_id = a.id
JOIN race         rc ON r.race_id    = rc.id
JOIN pricing_lot  pl ON r.lot_id     = pl.id
LEFT JOIN payment p  ON p.registration_id = r.id
ORDER BY r.created_at DESC;

-- 3. RPC para o browser salvar a URL (SECURITY DEFINER bypassa RLS)
CREATE OR REPLACE FUNCTION salvar_comprovante_url(
  p_registration_id uuid,
  p_url             text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE registration
    SET comprovante_url = p_url
    WHERE id = p_registration_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Inscricao nao encontrada');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 4. Concede execucao para anon e authenticated
REVOKE ALL ON FUNCTION salvar_comprovante_url(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION salvar_comprovante_url(uuid, text) TO anon, authenticated;

-- 5. Verificacao
SELECT column_name FROM information_schema.columns
WHERE table_name = 'registration' AND column_name = 'comprovante_url';

SELECT proname FROM pg_proc WHERE proname = 'salvar_comprovante_url';
