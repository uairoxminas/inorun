// src/pages/DevHandshake.tsx
// Página de teste de conectividade com Supabase
// Rota: /dev/handshake (visível apenas em desenvolvimento)

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { testCalcCategoria } from '../lib/calcCategoria';
import { testValidaCPF } from '../lib/validaCPF';
import { testPrecoLoteAtual } from '../lib/precoLoteAtual';

interface HandshakeResult {
  status: 'idle' | 'loading' | 'ok' | 'error';
  message: string;
  data?: Record<string, unknown>;
}

export default function DevHandshake() {
  const [supabaseResult, setSupabaseResult] = useState<HandshakeResult>({ status: 'idle', message: '' });
  const [modulesResult, setModulesResult] = useState<HandshakeResult>({ status: 'idle', message: '' });

  const testSupabase = async () => {
    setSupabaseResult({ status: 'loading', message: 'Conectando ao Supabase...' });
    try {
      const payload = { mensagem: `Handshake INO RUN — ${new Date().toISOString()}` };

      // Escreve
      const { data: inserted, error: insertError } = await supabase
        .from('handshake_test')
        .insert(payload)
        .select()
        .single();

      if (insertError) throw insertError;

      // Lê de volta
      const { data: fetched, error: fetchError } = await supabase
        .from('handshake_test')
        .select('*')
        .eq('id', inserted.id)
        .single();

      if (fetchError) throw fetchError;

      setSupabaseResult({
        status: 'ok',
        message: '✅ Supabase conectado! Escrita e leitura funcionando.',
        data: fetched,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSupabaseResult({
        status: 'error',
        message: `❌ Erro: ${msg}`,
      });
    }
  };

  const testModules = () => {
    setModulesResult({ status: 'loading', message: 'Executando testes nos módulos puros...' });
    try {
      console.group('🧪 Testes dos Módulos Puros — INO RUN 2026');
      testCalcCategoria();
      testValidaCPF();
      testPrecoLoteAtual();
      console.groupEnd();
      setModulesResult({
        status: 'ok',
        message: '✅ Módulos puros testados! Veja o console do browser para detalhes.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setModulesResult({ status: 'error', message: `❌ Erro nos módulos: ${msg}` });
    }
  };

  const statusColor = (s: HandshakeResult['status']) => {
    if (s === 'ok') return '#22c55e';
    if (s === 'error') return '#ef4444';
    if (s === 'loading') return '#f59e0b';
    return '#6b7280';
  };

  return (
    <div style={{ fontFamily: 'monospace', maxWidth: 700, margin: '40px auto', padding: 24 }}>
      <h1 style={{ color: '#8417AE', marginBottom: 8 }}>🔧 DEV — Handshake INO RUN 2026</h1>
      <p style={{ color: '#6b7280', marginBottom: 32, fontSize: 13 }}>
        Esta página é apenas para desenvolvimento (Phase 2 — Link). Não aparece em produção.
      </p>

      {/* ── Seção: Objetivos e Instruções ── */}
      <section style={{ background: '#f3e8ff', borderRadius: 8, padding: 16, marginBottom: 32, border: '1px solid #d8b4fe' }}>
        <h2 style={{ color: '#5B0E7A', fontSize: 14, margin: '0 0 8px' }}>📋 Objetivo desta tela</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#4c1d95', lineHeight: 1.8 }}>
          <li><strong>Teste 1 — Supabase:</strong> escreve e lê na tabela <code>handshake_test</code></li>
          <li><strong>Teste 2 — Módulos Puros:</strong> executa todos os casos de teste de <code>calcCategoria</code>, <code>validaCPF</code> e <code>precoLoteAtual</code></li>
          <li>Pré-requisito: criar <code>.env.local</code> com URL e chave do Supabase</li>
          <li>Pré-requisito: executar a migration SQL no painel do Supabase</li>
        </ul>
      </section>

      {/* ── Teste 1: Supabase ── */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ color: '#374151', fontSize: 16 }}>1. Handshake — Supabase</h2>
        <button
          id="btn-test-supabase"
          onClick={testSupabase}
          disabled={supabaseResult.status === 'loading'}
          style={{
            background: '#8417AE', color: 'white', border: 'none', borderRadius: 6,
            padding: '10px 20px', cursor: 'pointer', fontSize: 14, marginBottom: 12,
          }}
        >
          {supabaseResult.status === 'loading' ? 'Testando...' : 'Testar conexão Supabase'}
        </button>
        {supabaseResult.message && (
          <div style={{ color: statusColor(supabaseResult.status), fontSize: 13, marginBottom: 8 }}>
            {supabaseResult.message}
          </div>
        )}
        {supabaseResult.data && (
          <pre style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: 12, fontSize: 12, overflowX: 'auto' }}>
            {JSON.stringify(supabaseResult.data, null, 2)}
          </pre>
        )}
      </section>

      {/* ── Teste 2: Módulos Puros ── */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ color: '#374151', fontSize: 16 }}>2. Testes — Módulos Puros</h2>
        <button
          id="btn-test-modules"
          onClick={testModules}
          disabled={modulesResult.status === 'loading'}
          style={{
            background: '#5B0E7A', color: 'white', border: 'none', borderRadius: 6,
            padding: '10px 20px', cursor: 'pointer', fontSize: 14, marginBottom: 12,
          }}
        >
          {modulesResult.status === 'loading' ? 'Testando...' : 'Executar testes dos módulos'}
        </button>
        {modulesResult.message && (
          <div style={{ color: statusColor(modulesResult.status), fontSize: 13 }}>
            {modulesResult.message}
          </div>
        )}
        {modulesResult.status === 'ok' && (
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
            💡 Abra o Console do Browser (F12 → Console) para ver o resultado de cada teste.
          </p>
        )}
      </section>

      {/* ── Migration SQL ── */}
      <section style={{ background: '#fef3c7', borderRadius: 8, padding: 16, border: '1px solid #fcd34d' }}>
        <h2 style={{ color: '#92400e', fontSize: 14, margin: '0 0 8px' }}>⚠️ Migration SQL necessária</h2>
        <p style={{ fontSize: 13, color: '#78350f', margin: '0 0 8px' }}>
          Execute no SQL Editor do Supabase antes de testar:
        </p>
        <pre style={{ background: '#fff', borderRadius: 6, padding: 12, fontSize: 12, margin: 0 }}>
{`CREATE TABLE IF NOT EXISTS handshake_test (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem text,
  criado_em timestamptz DEFAULT now()
);`}
        </pre>
      </section>
    </div>
  );
}
