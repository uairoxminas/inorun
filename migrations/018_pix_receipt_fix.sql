-- migrations/018_pix_receipt_fix.sql
-- Correcao definitiva do pix_receipt:
-- Garante colunas de comprovante e remove a restricao de UNIQUE necessaria para upsert
-- Executar no Supabase SQL Editor

-- 1. Garante que as colunas existem
ALTER TABLE pix_receipt
  ADD COLUMN IF NOT EXISTS comprovante_url  text,
  ADD COLUMN IF NOT EXISTS comprovante_mime text,
  ADD COLUMN IF NOT EXISTS em_analise       boolean DEFAULT false;

-- 2. Adiciona UNIQUE constraint (necessaria para upsert onConflict funcionar)
--    Ignora se ja existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pix_receipt_registration_id_unique'
  ) THEN
    ALTER TABLE pix_receipt
      ADD CONSTRAINT pix_receipt_registration_id_unique
      UNIQUE (registration_id);
  END IF;
END $$;

-- 3. Adiciona policy para permitir que a Edge Function (service_role) 
--    leia pix_receipt normalmente (ja tem, mas garante)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pix_receipt' AND policyname = 'service_role_only'
  ) THEN
    CREATE POLICY "service_role_only" ON pix_receipt
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- 4. Verifica resultado
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'pix_receipt'
ORDER BY ordinal_position;
