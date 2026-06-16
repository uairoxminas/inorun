#!/usr/bin/env node
// tools/test-connection.js — Verifica schema no Supabase via PostgREST
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const H = { 'apikey': SERVICE_ROLE, 'Authorization': `Bearer ${SERVICE_ROLE}` };

const tabelas = ['event', 'race', 'pricing_lot', 'athlete', 'coupon', 'registration', 'payment', 'schema_migrations'];

console.log('\n🔍 INO RUN 2026 — Verificação do Schema no Supabase\n');

for (const t of tabelas) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${t}?limit=0`, { headers: H });
  const status = res.status === 200 ? '✅' : res.status === 404 ? '❌' : `⚠️ ${res.status}`;
  console.log(`  ${status}  ${t}`);
}

// Verifica dados seed
const evRes  = await fetch(`${SUPABASE_URL}/rest/v1/event?select=nome,cidade,data_prova`, { headers: H });
const events = await evRes.json();
console.log('\n📋 Evento cadastrado:');
for (const e of events) console.log(`     ${e.nome} — ${e.cidade} — ${e.data_prova}`);

const rRes  = await fetch(`${SUPABASE_URL}/rest/v1/race?select=label,distancia_km,vagas_total`, { headers: H });
const races = await rRes.json();
console.log('\n🏃 Provas cadastradas:');
for (const r of races) console.log(`     ${r.label} (${r.vagas_total} vagas)`);

const lRes  = await fetch(`${SUPABASE_URL}/rest/v1/pricing_lot?select=nome,preco_centavos,fecha_em&order=ordem.asc`, { headers: H });
const lotes = await lRes.json();
console.log('\n💰 Lotes cadastrados:');
for (const l of lotes) {
  const preco = (l.preco_centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  console.log(`     ${l.nome}: ${preco}`);
}

const cRes   = await fetch(`${SUPABASE_URL}/rest/v1/coupon?select=codigo,tipo,valor`, { headers: H });
const cupons = await cRes.json();
console.log('\n🎟️  Cupons cadastrados:');
for (const c of cupons) console.log(`     ${c.codigo} — ${c.tipo} ${c.valor}%`);

console.log('\n✅ Schema verificado com sucesso!\n');
