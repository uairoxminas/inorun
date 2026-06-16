#!/usr/bin/env node
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

// Aguarda PostgREST recarregar o schema cache (até 10s)
console.log('Aguardando schema cache do PostgREST...');
await new Promise(r => setTimeout(r, 3000));

const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/diag_rls`, {
  method: 'POST',
  headers: {
    'apikey': SERVICE_ROLE,
    'Authorization': `Bearer ${SERVICE_ROLE}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({}),
});

const data = await res.json();
console.log('\n🔍 Estado real do banco:\n');
console.log('HTTP Status:', res.status);
if (data?.policies_athlete) {
  console.log('\n📋 Políticas RLS em athlete:');
  JSON.parse(JSON.stringify(data.policies_athlete)).forEach(p => console.log('  ', JSON.stringify(p)));
} else { console.log('policies_athlete:', data.policies_athlete); }

if (data?.grants_anon) {
  console.log('\n📋 Grants para anon:');
  JSON.parse(JSON.stringify(data.grants_anon)).forEach(g => console.log('  ', JSON.stringify(g)));
} else { console.log('grants_anon:', data.grants_anon); }

if (data?.rls_status) {
  console.log('\n📋 Status RLS:');
  JSON.parse(JSON.stringify(data.rls_status)).forEach(r => console.log('  ', JSON.stringify(r)));
} else { console.log('rls_status:', data.rls_status); }

if (!data?.policies_athlete) console.log('\nResposta completa:', JSON.stringify(data, null, 2));
