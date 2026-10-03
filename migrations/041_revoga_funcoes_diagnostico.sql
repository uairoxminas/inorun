-- migrations/041_revoga_funcoes_diagnostico.sql
-- INO RUN 2026 — Segurança: funções de diagnóstico/migração e de confirmação de pagamento
-- estavam executáveis pela chave pública (anon). exec_sql permitia rodar SQL arbitrário.
-- Nenhuma delas é chamada pelo site; service_role (tools/migrate.js, edge functions) mantém acesso.
-- Já aplicada em produção em 03/10/2026.

REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._tmp_query() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.diag_rls() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.confirmar_pagamento_mock(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.confirmar_pagamento(text, timestamptz) FROM PUBLIC, anon, authenticated;
