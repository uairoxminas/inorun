-- migrations/009_cronograma.sql
-- Cronograma de prova por categoria: largadas por ondas/grupos

CREATE TABLE IF NOT EXISTS race_wave (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id     uuid NOT NULL REFERENCES race(id) ON DELETE CASCADE,
  nome        text NOT NULL,          -- ex: 'Onda A — F Sub-20 / M Sub-20'
  categorias  text[] NOT NULL DEFAULT '{}',  -- ex: ['F Sub-20', 'M Sub-20']
  largada_at  timestamptz NOT NULL,   -- data+hora da largada (11/10/2026 07:00 etc.)
  ordem       int NOT NULL DEFAULT 1,
  cor         text DEFAULT '#8417AE', -- cor de identificação visual
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_race_wave_race ON race_wave(race_id);

ALTER TABLE race_wave ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wave_anon" ON race_wave;
CREATE POLICY "wave_anon" ON race_wave FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON race_wave TO anon;
GRANT SELECT ON race_wave TO authenticated;

-- Seed: cronograma padrão sugerido para INO RUN 2026
-- (5 km começa 07:00, 10 km começa 07:30 — organizador pode ajustar)
INSERT INTO race_wave (race_id, nome, categorias, largada_at, ordem, cor)
SELECT
  r.id,
  'Onda 1 — Geral 5 km',
  ARRAY['F Sub-20','M Sub-20','F 20-24','M 20-24','F 25-29','M 25-29'],
  '2026-10-11 07:00:00-03'::timestamptz,
  1,
  '#8417AE'
FROM race r WHERE r.distancia_km = 5
ON CONFLICT DO NOTHING;

INSERT INTO race_wave (race_id, nome, categorias, largada_at, ordem, cor)
SELECT
  r.id,
  'Onda 2 — Faixas superiores 5 km',
  ARRAY['F 30-34','M 30-34','F 35-39','M 35-39','F 40-44','M 40-44','F 45-49','M 45-49','F 50+','M 50+'],
  '2026-10-11 07:15:00-03'::timestamptz,
  2,
  '#5B0E7A'
FROM race r WHERE r.distancia_km = 5
ON CONFLICT DO NOTHING;

INSERT INTO race_wave (race_id, nome, categorias, largada_at, ordem, cor)
SELECT
  r.id,
  'Onda 1 — Geral 10 km',
  ARRAY['F Sub-20','M Sub-20','F 20-24','M 20-24','F 25-29','M 25-29','F 30-34','M 30-34'],
  '2026-10-11 07:30:00-03'::timestamptz,
  1,
  '#FFD200'
FROM race r WHERE r.distancia_km = 10
ON CONFLICT DO NOTHING;

INSERT INTO race_wave (race_id, nome, categorias, largada_at, ordem, cor)
SELECT
  r.id,
  'Onda 2 — Faixas superiores 10 km',
  ARRAY['F 35-39','M 35-39','F 40-44','M 40-44','F 45-49','M 45-49','F 50+','M 50+'],
  '2026-10-11 07:45:00-03'::timestamptz,
  2,
  '#A93FD0'
FROM race r WHERE r.distancia_km = 10
ON CONFLICT DO NOTHING;

-- Função para salvar/atualizar onda
CREATE OR REPLACE FUNCTION admin_salvar_onda(
  p_id         uuid,
  p_race_id    uuid,
  p_nome       text,
  p_categorias text[],
  p_largada_at timestamptz,
  p_ordem      int,
  p_cor        text DEFAULT '#8417AE'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id uuid;
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE race_wave
    SET nome = p_nome, categorias = p_categorias, largada_at = p_largada_at,
        ordem = p_ordem, cor = p_cor
    WHERE id = p_id
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO race_wave (race_id, nome, categorias, largada_at, ordem, cor)
    VALUES (p_race_id, p_nome, p_categorias, p_largada_at, p_ordem, p_cor)
    RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_salvar_onda(uuid,uuid,text,text[],timestamptz,int,text) TO anon;
