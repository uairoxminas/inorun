#!/usr/bin/env node
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

console.log('Testando via PostgREST + service_role...');

// Tenta criar uma função auxiliar e chamar via RPC
const tests = [
  // Test 1: SELECT simples via PostgREST GET
  {
    label: 'GET /rest/v1/schema_migrations',
    fn: async () => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/schema_migrations?select=filename&limit=1`, {
        headers: {
          'apikey': SERVICE_ROLE,
          'Authorization': `Bearer ${SERVICE_ROLE}`,
        }
      });
      return { status: res.status, body: await res.text() };
    }
  },
  // Test 2: RPC exec_sql se existir
  {
    label: 'POST /rest/v1/rpc/exec_sql',
    fn: async () => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_ROLE,
          'Authorization': `Bearer ${SERVICE_ROLE}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql: 'SELECT 1' })
      });
      return { status: res.status, body: await res.text() };
    }
  },
  // Test 3: pg_catalog via PostgREST
  {
    label: 'GET /rest/v1/ (schema info)',
    fn: async () => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        headers: {
          'apikey': SERVICE_ROLE,
          'Authorization': `Bearer ${SERVICE_ROLE}`,
        }
      });
      return { status: res.status, body: (await res.text()).slice(0, 200) };
    }
  },
];

for (const t of tests) {
  try {
    const r = await t.fn();
    console.log(`\n${t.label}: HTTP ${r.status}`);
    console.log('  Body:', r.body.slice(0, 300));
  } catch(e) {
    console.log(`\n${t.label}: ERRO — ${e.message}`);
  }
}
