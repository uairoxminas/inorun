-- migrations/019_pix_receipt_admin_read.sql
-- Permite que administradores autenticados leiam pix_receipt
-- O INSERT/UPDATE continua sendo exclusivo do service_role (Edge Functions)
-- Executar no Supabase SQL Editor

-- 1. Policy de leitura para usuários autenticados (admins no painel)
CREATE POLICY IF NOT EXISTS "authenticated_can_read_pix_receipt"
ON pix_receipt
FOR SELECT
TO authenticated
USING (true);

-- 2. Verifica as policies ativas
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'pix_receipt';
