-- migrations/045_revoga_edicao_inscricao_anon.sql
-- INO RUN 2026 — Fecha a edição de inscrições para a chave pública (anon).
--
-- PROBLEMA
-- admin_editar_inscricao_completa(uuid, jsonb) e admin_editar_inscricao(...) são
-- SECURITY DEFINER e estavam com EXECUTE liberado para anon. As duas alteram
-- registration.status. Como a chave anon vai no bundle público do site, qualquer
-- pessoa com o DevTools aberto podia confirmar uma inscrição sem pagar ou alterar
-- as inscrições já confirmadas. Mesma classe de risco da migration 041.
--
-- ⚠️ EFEITO COLATERAL — LEIA ANTES DE EXECUTAR
-- O painel do organizador chama essas duas RPCs direto do browser com a chave
-- anon (src/services/adminService.ts → editarInscricao / editarInscricaoCompleta).
-- Depois deste REVOKE, o botão "Salvar" do drawer "Ver / Editar" passa a falhar
-- com "permission denied for function". O resto do painel continua funcionando:
-- check-in, confirmar/rejeitar comprovante, listagens, CSV/Excel e financeiro
-- usam outras funções e não são afetados por esta migration.
--
-- Para restaurar a edição é preciso autenticação real de admin (Supabase Auth +
-- checagem de auth.uid() dentro da função, ou uma Edge Function com service_role).
-- Enquanto isso não existir, a edição fica indisponível no painel.
--
-- RECOMENDAÇÃO DE JANELA: executar DEPOIS da prova (11/10/2026), junto com a
-- correção de autenticação. Aplicar na véspera tira uma ferramenta do organizador
-- no pior momento possível.

-- ══════════════════════════════════════════════════════════════
-- 1. REVOGA A EDIÇÃO COMPLETA (migration 042)
-- ══════════════════════════════════════════════════════════════
REVOKE EXECUTE ON FUNCTION public.admin_editar_inscricao_completa(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- 2. REVOGA A EDIÇÃO ANTIGA (migration 010)
--    Mesma capacidade: também grava registration.status. Sem este REVOKE,
--    o passo 1 não fecha nada — basta chamar a função antiga.
-- ══════════════════════════════════════════════════════════════
REVOKE EXECUTE ON FUNCTION public.admin_editar_inscricao(uuid, text, text, text, text, text, uuid)
  FROM PUBLIC, anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- 3. MANTÉM O ACESSO PARA service_role
--    É por aqui que uma Edge Function (padrão admin-confirmar) vai chamar
--    as funções depois que a autenticação de admin existir.
-- ══════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION public.admin_editar_inscricao_completa(uuid, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_editar_inscricao(uuid, text, text, text, text, text, uuid)
  TO service_role;

-- ══════════════════════════════════════════════════════════════
-- 4. VERIFICAÇÃO — rode depois e confira o resultado
--    Esperado: nenhuma linha com grantee 'anon' ou 'authenticated'.
-- ══════════════════════════════════════════════════════════════
-- SELECT p.proname, a.grantee, a.privilege_type
-- FROM information_schema.routine_privileges a
-- JOIN pg_proc p ON p.proname = a.routine_name
-- WHERE a.routine_name IN ('admin_editar_inscricao', 'admin_editar_inscricao_completa')
-- ORDER BY p.proname, a.grantee;
