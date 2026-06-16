#!/usr/bin/env node
// tools/migrate.js — INO RUN 2026 · Migration Runner automático
// Estratégia: cria função exec_sql no Supabase e executa via RPC
// Uso: npm run migrate          → aplica migrations pendentes
//      npm run migrate:dry      → mostra o que seria executado
//      npm run migrate:undo     → remove registro da última migration

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname      = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const UNDO    = args.includes('--undo');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE não definidos no .env!');
  process.exit(1);
}

const HEADERS = {
  'apikey':        SERVICE_ROLE,
  'Authorization': `Bearer ${SERVICE_ROLE}`,
  'Content-Type':  'application/json',
  'Prefer':        'return=representation',
};

// ── Cores console ───────────────────────────────────────────────────────────
const C = { p:'\x1b[35m', g:'\x1b[32m', y:'\x1b[33m', r:'\x1b[31m', d:'\x1b[90m', b:'\x1b[1m', c:'\x1b[36m', x:'\x1b[0m' };
const log  = (m) => console.log(`${C.p}[migrate]${C.x} ${m}`);
const ok   = (m) => console.log(`${C.g}✅${C.x} ${m}`);
const warn = (m) => console.log(`${C.y}⚠️ ${C.x} ${m}`);
const fail = (m) => console.error(`${C.r}❌${C.x} ${m}`);
const info = (m) => console.log(`${C.d}   ${m}${C.x}`);

// ── Bootstrap: cria a função exec_sql e a tabela schema_migrations ──────────
const BOOTSTRAP_SQL = `
-- Função auxiliar para executar SQL arbitrário (usada pelo migration runner)
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE result jsonb;
BEGIN
  EXECUTE sql;
  result := '{"ok": true}'::jsonb;
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM, 'code', SQLSTATE);
END;
$$;

-- Revoga acesso público (só service_role pode chamar)
REVOKE ALL ON FUNCTION exec_sql(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION exec_sql(text) TO service_role;

-- Tabela de controle de migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
  id         serial      PRIMARY KEY,
  filename   text        NOT NULL UNIQUE,
  applied_at timestamptz NOT NULL DEFAULT now(),
  checksum   text
);

-- RLS: apenas service_role acessa
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "only_service" ON schema_migrations;
CREATE POLICY "only_service" ON schema_migrations
  FOR ALL TO service_role USING (true) WITH CHECK (true);
`;

// ── Chama exec_sql via RPC ───────────────────────────────────────────────────
async function rpcExec(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ sql }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
  if (body?.error) throw new Error(body.error);
  return body;
}

// ── Query via PostgREST (SELECT) ────────────────────────────────────────────
async function pgSelect(table, select = '*', filter = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}${filter ? '&' + filter : ''}`;
  const res = await fetch(url, { headers: HEADERS });
  if (res.status === 404) return []; // tabela não existe ainda
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET ${table}: ${body}`);
  }
  return res.json();
}

// ── Insert via PostgREST ─────────────────────────────────────────────────────
async function pgInsert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`INSERT ${table}: ${body}`);
  }
}

// ── Delete via PostgREST ─────────────────────────────────────────────────────
async function pgDelete(table, filter) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: HEADERS,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`DELETE ${table}: ${body}`);
  }
}

// ── Checksum ────────────────────────────────────────────────────────────────
function checksum(content) {
  let h = 0;
  for (let i = 0; i < content.length; i++) { h = ((h << 5) - h) + content.charCodeAt(i); h |= 0; }
  return Math.abs(h).toString(16).padStart(8, '0');
}

// ── Arquivos de migration ────────────────────────────────────────────────────
function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) { warn('Pasta migrations/ não encontrada.'); return []; }
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql') && !f.includes('.down.'))
    .sort();
}

// ── Roda migrations ─────────────────────────────────────────────────────────
async function runMigrations() {
  console.log(`\n${C.b}${C.p}🚀 INO RUN 2026 — Migration Runner${C.x}`);
  console.log(`${C.d}   Supabase: ${SUPABASE_URL}${C.x}`);
  if (DRY_RUN) warn('Modo DRY RUN — nenhuma alteração no banco\n');
  else console.log('');

  // Step 1: Bootstrap (exec_sql + schema_migrations)
  log('Verificando bootstrap (exec_sql + schema_migrations)...');
  try {
    // Testa se exec_sql já existe
    await rpcExec('SELECT 1');
    info('exec_sql já existe ✓');
  } catch {
    // Não existe ainda — precisa criar via bootstrap direto
    // Como não temos acesso direto, usamos a abordagem de criar via REST
    log('Criando infraestrutura de migrations...');
    
    if (!DRY_RUN) {
      // Usa o endpoint SQL da API do Supabase (v2 - sem PAT necessário para service_role projects)
      // Tenta via Management API com service_role como Authorization
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: { ...HEADERS, 'Prefer': '' },
        body: JSON.stringify({ sql: BOOTSTRAP_SQL }),
      });
      
      if (res.status === 404) {
        // exec_sql não existe — precisamos criá-la primeiro via outro método
        // Única opção sem PAT: usar o endpoint de funções do PostgREST em modo admin
        fail('exec_sql não existe e não há como criá-la sem acesso direto ao banco.');
        fail('Por favor, execute o seguinte SQL APENAS UMA VEZ no Supabase SQL Editor:');
        console.log('\n' + BOOTSTRAP_SQL + '\n');
        console.log('Depois rode npm run migrate novamente.\n');
        process.exit(0);
      }
    }
  }

  // Step 2: Migrations
  const appliedRows = await pgSelect('schema_migrations', 'filename,checksum');
  const applied     = new Map(appliedRows.map(r => [r.filename, r.checksum]));
  const files       = getMigrationFiles();

  if (files.length === 0) { warn('Nenhuma migration encontrada.'); return; }
  log(`${files.length} arquivo(s) · ${applied.size} já aplicado(s)\n`);

  let pendentes = 0, executadas = 0;

  for (const filename of files) {
    const content = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');
    const cs      = checksum(content);

    if (applied.has(filename)) {
      if (applied.get(filename) !== cs) warn(`${filename} — checksum diverge!`);
      else info(`${filename} — já aplicado ✓`);
      continue;
    }

    pendentes++;
    if (DRY_RUN) {
      console.log(`\n${C.c}[DRY RUN]${C.x} ${C.b}${filename}${C.x}`);
      content.trim().split('\n').slice(0, 5).forEach(l => info(l));
      continue;
    }

    console.log(`\n${C.b}▶ Aplicando: ${filename}${C.x}`);
    try {
      await rpcExec(content);
      await pgInsert('schema_migrations', { filename, checksum: cs });
      ok(`${filename}`);
      executadas++;
    } catch (e) {
      fail(`Falha em ${filename}: ${e.message}`);
      throw e;
    }
  }

  console.log('');
  if (DRY_RUN)         log(`${pendentes} pendente(s). Rode sem --dry-run para aplicar.`);
  else if (!pendentes) ok('Banco atualizado! Nenhuma migration pendente.');
  else                 ok(`${executadas}/${pendentes} migration(s) aplicada(s)!`);

  const estado = await pgSelect('schema_migrations', 'filename,applied_at', 'order=filename.asc');
  if (estado.length) {
    console.log(`\n${C.d}Histórico de migrations:${C.x}`);
    for (const r of estado) {
      const d = new Date(r.applied_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      info(`${r.filename}  →  ${d}`);
    }
  }
  console.log('');
}

// ── Undo ─────────────────────────────────────────────────────────────────────
async function undoLastMigration() {
  console.log(`\n${C.b}${C.y}⏪ Migration UNDO${C.x}\n`);
  const rows = await pgSelect('schema_migrations', 'filename', 'order=filename.desc&limit=1');
  if (!rows.length) { warn('Nenhuma migration para desfazer.'); return; }
  const last     = rows[0].filename;
  const downFile = path.join(MIGRATIONS_DIR, last.replace('.sql', '.down.sql'));
  if (fs.existsSync(downFile)) {
    await rpcExec(fs.readFileSync(downFile, 'utf-8'));
    ok(`Script DOWN executado para ${last}`);
  } else {
    warn(`Sem .down.sql para ${last}. Apenas removendo o registro.`);
  }
  await pgDelete('schema_migrations', `filename=eq.${encodeURIComponent(last)}`);
  ok(`Registro removido: ${last}`);
}

// ── Entry ─────────────────────────────────────────────────────────────────────
(async () => {
  try {
    if (UNDO) await undoLastMigration();
    else      await runMigrations();
  } catch (e) {
    fail('Migration abortada.'); process.exit(1);
  }
})();
