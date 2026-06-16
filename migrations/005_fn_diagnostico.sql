-- migrations/005_fn_diagnostico.sql
-- Função de diagnóstico RLS (removida após uso)
CREATE OR REPLACE FUNCTION diag_rls()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pols  jsonb;
  v_grants jsonb;
  v_rls   jsonb;
BEGIN
  SELECT jsonb_agg(row_to_json(t)) INTO v_pols FROM (
    SELECT polname,
           polcmd::text AS cmd,
           array_to_string(polroles::text[], ',') AS roles,
           pg_get_expr(polwithcheck, polrelid) AS withcheck
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    WHERE c.relname = 'athlete'
  ) t;

  SELECT jsonb_agg(row_to_json(t)) INTO v_grants FROM (
    SELECT table_name, privilege_type, grantee
    FROM information_schema.role_table_grants
    WHERE table_name IN ('athlete','registration','payment','coupon')
      AND grantee IN ('anon','authenticated')
    ORDER BY table_name, privilege_type
  ) t;

  SELECT jsonb_agg(row_to_json(t)) INTO v_rls FROM (
    SELECT relname, relrowsecurity AS rls_enabled
    FROM pg_class
    WHERE relname IN ('athlete','registration','payment') AND relkind = 'r'
  ) t;

  RETURN jsonb_build_object(
    'policies_athlete', v_pols,
    'grants_anon',      v_grants,
    'rls_status',       v_rls
  );
END;
$$;

GRANT EXECUTE ON FUNCTION diag_rls() TO anon;
