-- migrations/004_grants_anon.sql
-- Phase 3 fix: GRANT de privilégios de tabela para o role anon
-- No Supabase, RLS + GRANT são OBRIGATÓRIOS em conjunto.
-- A política RLS define QUEM pode VER/ESCREVER; o GRANT define o PRIVILÉGIO de acesso.

-- Privilégios de tabela para o fluxo público de inscrição
GRANT INSERT           ON TABLE athlete       TO anon;
GRANT INSERT, SELECT   ON TABLE registration  TO anon;
GRANT INSERT, SELECT   ON TABLE payment       TO anon;
GRANT SELECT           ON TABLE coupon        TO anon;
GRANT SELECT           ON TABLE race          TO anon;
GRANT SELECT           ON TABLE pricing_lot   TO anon;
GRANT SELECT           ON TABLE event         TO anon;

-- Sequences (necessário para colunas serial/identity usadas internamente)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
