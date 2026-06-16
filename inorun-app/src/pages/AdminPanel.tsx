// src/pages/AdminPanel.tsx
// Painel do organizador — INO RUN 2026
// Métricas, inscritos por prova, gestão de lotes, tabela com exportar CSV.
// NOTA: dados são mock neste estágio (Phase 4). Phase 3 conecta ao Supabase.

import { useState } from 'react';
import Logo from '../components/Logo';
import { LOTES_5KM, LOTES_10KM, precoLoteAtual, formataBRL } from '../lib/precoLoteAtual';

interface Props {
  onBack: () => void;
  totalInscritos: number;
}

// Mock de inscritos — na Phase 3 vem do Supabase com RLS
const INSCRITOS_MOCK = [
  { nome: 'Mariana Alves',    dist: '10 km', cat: 'F 30-34', lote: 2, valor: 10900, status: 'Confirmado', pag: 'Pix' },
  { nome: 'Rafael Souza',     dist: '10 km', cat: 'M 35-39', lote: 2, valor: 10900, status: 'Confirmado', pag: 'Cartão' },
  { nome: 'Júlia Mendes',     dist: '5 km',  cat: 'F 25-29', lote: 1, valor: 7900,  status: 'Confirmado', pag: 'Pix' },
  { nome: 'Bruno Carvalho',   dist: '5 km',  cat: 'M 40-44', lote: 2, valor: 8900,  status: 'Pendente',   pag: 'Pix' },
  { nome: 'Camila Rocha',     dist: '5 km',  cat: 'F 20-24', lote: 2, valor: 8900,  status: 'Confirmado', pag: 'Cartão' },
  { nome: 'Diego Fernandes',  dist: '10 km', cat: 'M 45-49', lote: 1, valor: 9900,  status: 'Confirmado', pag: 'Pix' },
];

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-5">
      <div className="text-[12px] text-brand-muted tracking-[0.1em] uppercase font-medium">{label}</div>
      <div className="font-display font-extrabold text-[30px] text-brand-purple mt-1.5">{value}</div>
      {sub && <div className="text-[12px] text-brand-muted mt-0.5">{sub}</div>}
    </div>
  );
}

export default function AdminPanel({ onBack, totalInscritos }: Props) {
  const [busca, setBusca] = useState('');

  const inscritosFiltrados = INSCRITOS_MOCK.filter(r =>
    r.nome.toLowerCase().includes(busca.toLowerCase()) ||
    r.dist.includes(busca) ||
    r.cat.toLowerCase().includes(busca.toLowerCase())
  );

  const total5km = INSCRITOS_MOCK.filter(r => r.dist === '5 km').length + totalInscritos;
  const total10km = INSCRITOS_MOCK.filter(r => r.dist === '10 km').length;
  const receitaCentavos = INSCRITOS_MOCK.reduce((a, r) => a + r.valor, 0) + totalInscritos * 7900;
  const confirmados = INSCRITOS_MOCK.filter(r => r.status === 'Confirmado').length;

  const maxPorProva = Math.max(total5km, total10km);

  // Exportar CSV
  const exportCSV = () => {
    const header = ['Nome', 'Distância', 'Categoria', 'Lote', 'Valor (R$)', 'Pagamento', 'Status'];
    const rows = INSCRITOS_MOCK.map(r => [
      r.nome, r.dist, r.cat, `Lote ${r.lote}`,
      (r.valor / 100).toFixed(2).replace('.', ','),
      r.pag, r.status
    ]);
    const csv = [header, ...rows].map(row => row.join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'inorun-inscritos.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-brand-bg text-brand-ink font-sans min-h-screen">
      <div className="mx-auto px-5 py-6 max-w-[1000px]">

        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="btn-ghost">← Ver site público</button>
          <div className="flex items-center gap-2">
            <Logo height={26} />
            <span className="text-brand-muted text-[14px]">· Painel do Organizador</span>
          </div>
        </div>

        {/* ── Seção informativa ── */}
        <div className="mt-4 bg-brand-lilac border border-brand-lilac-mid rounded-xl px-4 py-3 text-[13px] text-brand-purple-dark">
          <strong>Painel do Organizador — INO RUN 2026:</strong> métricas em tempo real, inscritos por prova,
          gestão de lotes e exportação de dados. Acesso restrito — dados protegidos por RLS no Supabase (Phase 3).
        </div>

        <h1 className="font-display font-extrabold italic uppercase text-[40px] text-brand-ink mt-5 leading-none">
          Visão geral
        </h1>

        {/* ── Métricas ── */}
        <div className="mt-5 grid gap-3 grid-cols-2 md:grid-cols-4">
          <MetricCard label="Total inscritos" value={totalInscritos.toLocaleString('pt-BR')} sub="todas as provas" />
          <MetricCard label="Receita" value={formataBRL(receitaCentavos)} sub="pagamentos confirmados" />
          <MetricCard label="Confirmados" value={`${confirmados}/${INSCRITOS_MOCK.length}`} sub="mock local" />
          <MetricCard label="Lote atual" value={precoLoteAtual('5km')?.nome ?? 'Encerrado'} sub="5 km e 10 km" />
        </div>

        {/* ── Gráficos + Lotes ── */}
        <div className="mt-6 grid gap-4 md:grid-cols-2">

          {/* Por prova */}
          <div className="card p-5">
            <div className="font-semibold text-brand-ink mb-4">Inscritos por prova</div>
            <div className="grid gap-4">
              {[
                { label: '5 km', count: total5km, vagas: 280 },
                { label: '10 km', count: total10km, vagas: 160 },
              ].map(p => (
                <div key={p.label}>
                  <div className="flex justify-between text-[13px] text-brand-muted mb-1.5">
                    <span className="font-medium text-brand-ink">{p.label}</span>
                    <span>{p.count} / {p.vagas} vagas</span>
                  </div>
                  <div className="h-2.5 bg-brand-lilac rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-purple rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (p.count / maxPorProva) * 100)}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-brand-muted mt-1">
                    {Math.round((p.count / p.vagas) * 100)}% das vagas preenchidas
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Gestão de lotes */}
          <div className="card p-5">
            <div className="font-semibold text-brand-ink mb-4">Gestão de lotes</div>

            <div className="mb-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-brand-muted mb-2">5 km</p>
              <div className="grid gap-2">
                {LOTES_5KM.map(l => {
                  const ativo = precoLoteAtual('5km')?.id === l.id;
                  return (
                    <div key={l.id} className="flex items-center justify-between bg-brand-bg rounded-xl px-4 py-3 text-[14px]">
                      <div>
                        <span className="font-medium">{l.nome}</span>
                        <span className="text-brand-muted text-[12px] ml-2">{formataBRL(l.preco_centavos)}</span>
                      </div>
                      <span className={`text-[12px] px-3 py-0.5 rounded-full font-medium ${
                        ativo
                          ? 'bg-brand-purple text-white'
                          : 'border border-brand-lilac-mid text-brand-muted'
                      }`}>
                        {ativo ? 'Ativo' : new Date() > l.fecha_em ? 'Encerrado' : 'Agendado'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-brand-muted mb-2">10 km</p>
              <div className="grid gap-2">
                {LOTES_10KM.map(l => {
                  const ativo = precoLoteAtual('10km')?.id === l.id;
                  return (
                    <div key={l.id} className="flex items-center justify-between bg-brand-bg rounded-xl px-4 py-3 text-[14px]">
                      <div>
                        <span className="font-medium">{l.nome}</span>
                        <span className="text-brand-muted text-[12px] ml-2">{formataBRL(l.preco_centavos)}</span>
                      </div>
                      <span className={`text-[12px] px-3 py-0.5 rounded-full font-medium ${
                        ativo
                          ? 'bg-brand-purple text-white'
                          : 'border border-brand-lilac-mid text-brand-muted'
                      }`}>
                        {ativo ? 'Ativo' : new Date() > l.fecha_em ? 'Encerrado' : 'Agendado'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabela de inscritos ── */}
        <div className="mt-6 card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="font-semibold text-brand-ink">Inscritos recentes</div>
            <div className="flex items-center gap-3">
              <input
                id="busca-inscritos"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="input text-[13px] py-2 w-48"
                placeholder="Buscar atleta, prova..."
              />
              <button
                id="btn-exportar-csv"
                onClick={exportCSV}
                className="btn-primary text-[13px] py-2 px-4"
              >
                Exportar CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr className="text-brand-muted text-left text-[12px] uppercase tracking-[0.08em]">
                  {['Atleta', 'Prova', 'Categoria', 'Valor', 'Pagamento', 'Status'].map(h => (
                    <th key={h} className="px-2.5 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inscritosFiltrados.map((r, i) => (
                  <tr key={i} className="border-t border-brand-lilac-mid hover:bg-brand-bg transition-colors">
                    <td className="px-2.5 py-3 font-medium text-brand-ink">{r.nome}</td>
                    <td className="px-2.5 py-3 text-brand-muted">{r.dist}</td>
                    <td className="px-2.5 py-3 text-brand-muted">{r.cat}</td>
                    <td className="px-2.5 py-3 font-medium">{formataBRL(r.valor)}</td>
                    <td className="px-2.5 py-3 text-brand-muted">{r.pag}</td>
                    <td className="px-2.5 py-3">
                      <span className={r.status === 'Confirmado' ? 'badge-status-ok' : 'badge-status-pending'}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {inscritosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-brand-muted py-8 text-[14px]">
                      Nenhum resultado encontrado para "{busca}"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[12px] text-brand-muted mt-3">
            ⚠️ <em>Dados mock — na Phase 3 (Architect) conectado ao Supabase com RLS e paginação real.</em>
          </p>
        </div>
      </div>
    </div>
  );
}
