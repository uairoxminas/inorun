// src/pages/AdminPanel.tsx — Painel do organizador com dados reais do Supabase

import { useState, useEffect } from 'react';
import Logo from '../components/Logo';
import { getInscritos, calcularMetricas, gerarCSV } from '../services/adminService';
import type { InscritoRow, MetricasAdmin } from '../services/adminService';
import { formataBRL } from '../lib/precoLoteAtual';

interface Props { onBack: () => void; totalInscritos: number; }

function MetricCard({ label, value, sub, destaque }: { label: string; value: string; sub?: string; destaque?: boolean }) {
  return (
    <div className={`card p-5 ${destaque ? 'border-brand-purple-mid' : ''}`}>
      <div className="text-[12px] text-brand-muted tracking-[0.1em] uppercase font-medium">{label}</div>
      <div className={`font-display font-extrabold text-[28px] mt-1.5 ${destaque ? 'text-brand-purple' : 'text-brand-purple'}`}>{value}</div>
      {sub && <div className="text-[12px] text-brand-muted mt-0.5">{sub}</div>}
    </div>
  );
}

export default function AdminPanel({ onBack, totalInscritos }: Props) {
  const [inscritos, setInscritos]   = useState<InscritoRow[]>([]);
  const [metricas, setMetricas]     = useState<MetricasAdmin | null>(null);
  const [loading, setLoading]       = useState(true);
  const [busca, setBusca]           = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');

  useEffect(() => {
    getInscritos()
      .then(rows => {
        setInscritos(rows);
        setMetricas(calcularMetricas(rows));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const inscritosFiltrados = inscritos.filter(r => {
    const matchBusca = !busca ||
      r.nome.toLowerCase().includes(busca.toLowerCase()) ||
      r.categoria?.toLowerCase().includes(busca.toLowerCase()) ||
      r.prova?.toLowerCase().includes(busca.toLowerCase()) ||
      r.email?.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = filtroStatus === 'todos' || r.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  const handleExportCSV = () => {
    const csv  = gerarCSV(inscritosFiltrados);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `inorun-inscritos-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleRecarregar = async () => {
    setLoading(true);
    const rows = await getInscritos().catch(() => inscritos);
    setInscritos(rows);
    setMetricas(calcularMetricas(rows));
    setLoading(false);
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

        {/* Info box */}
        <div className="mt-4 bg-brand-lilac border border-brand-lilac-mid rounded-xl px-4 py-3 text-[13px] text-brand-purple-dark">
          <strong>Painel do Organizador — INO RUN 2026:</strong> dados em tempo real do Supabase.
          Métricas, inscritos por prova, exportação CSV. Acesso protegido por RLS.
        </div>

        <div className="flex items-center justify-between mt-5">
          <h1 className="font-display font-extrabold italic uppercase text-[36px] text-brand-ink leading-none">Visão geral</h1>
          <button onClick={handleRecarregar} disabled={loading}
            className="btn-ghost text-[13px]">
            {loading ? '↺ Atualizando...' : '↺ Atualizar'}
          </button>
        </div>

        {/* ── Métricas ── */}
        {loading ? (
          <div className="mt-5 grid gap-3 grid-cols-2 md:grid-cols-4">
            {[0,1,2,3].map(i => <div key={i} className="card p-5 h-24 animate-pulse bg-brand-lilac" />)}
          </div>
        ) : metricas ? (
          <div className="mt-5 grid gap-3 grid-cols-2 md:grid-cols-4">
            <MetricCard label="Total inscritos"  value={(metricas.total + (totalInscritos - 842)).toLocaleString('pt-BR')} sub="todas as provas" destaque />
            <MetricCard label="Confirmados"      value={metricas.confirmados.toLocaleString('pt-BR')} sub="pagamento confirmado" />
            <MetricCard label="Receita"          value={formataBRL(metricas.receita_centavos)} sub="pagamentos confirmados" />
            <MetricCard label="Pendentes"        value={metricas.pendentes.toLocaleString('pt-BR')} sub="aguardando pagamento" />
          </div>
        ) : null}

        {/* ── Gráficos ── */}
        {!loading && metricas && (
          <div className="mt-6 grid gap-4 md:grid-cols-2">

            {/* Inscritos por prova */}
            <div className="card p-5">
              <div className="font-semibold text-brand-ink mb-4">Inscritos por prova</div>
              {[
                { label: '5 km', count: metricas.inscritos_5km, vagas: metricas.vagas_5km },
                { label: '10 km', count: metricas.inscritos_10km, vagas: metricas.vagas_10km },
              ].map(p => (
                <div key={p.label} className="mb-4">
                  <div className="flex justify-between text-[13px] mb-1.5">
                    <span className="font-medium text-brand-ink">{p.label}</span>
                    <span className="text-brand-muted">{p.count} / {p.vagas} vagas ({Math.round((p.count/p.vagas)*100)}%)</span>
                  </div>
                  <div className="h-2.5 bg-brand-lilac rounded-full overflow-hidden">
                    <div className="h-full bg-brand-purple rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, (p.count/p.vagas)*100)}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Status breakdown */}
            <div className="card p-5">
              <div className="font-semibold text-brand-ink mb-4">Status das inscrições</div>
              {[
                { label: 'Confirmados',  count: metricas.confirmados, cor: 'bg-green-500' },
                { label: 'Pendentes',    count: metricas.pendentes,   cor: 'bg-yellow-400' },
                { label: 'Cancelados',   count: metricas.total - metricas.confirmados - metricas.pendentes, cor: 'bg-red-400' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between py-2 border-b border-brand-lilac-mid last:border-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${s.cor}`} />
                    <span className="text-[14px] text-brand-ink">{s.label}</span>
                  </div>
                  <span className="font-display font-bold text-[18px] text-brand-purple">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tabela de inscritos ── */}
        <div className="mt-6 card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="font-semibold text-brand-ink">
              Inscritos {inscritosFiltrados.length !== inscritos.length && `(${inscritosFiltrados.length} filtrados)`}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
                className="input text-[13px] py-2 w-36">
                <option value="todos">Todos</option>
                <option value="confirmado">Confirmados</option>
                <option value="pendente">Pendentes</option>
                <option value="cancelado">Cancelados</option>
              </select>
              <input id="busca-inscritos" value={busca} onChange={e => setBusca(e.target.value)}
                className="input text-[13px] py-2 w-48" placeholder="Buscar nome, prova..." />
              <button id="btn-exportar-csv" onClick={handleExportCSV}
                className="btn-primary text-[13px] py-2 px-4">
                Exportar CSV
              </button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[0,1,2].map(i => <div key={i} className="h-12 bg-brand-lilac rounded-xl animate-pulse" />)}
            </div>
          ) : inscritos.length === 0 ? (
            <div className="text-center text-brand-muted py-12">
              <div className="text-4xl mb-3">🏃</div>
              <div className="font-display font-bold text-[20px] text-brand-purple">Nenhum inscrito ainda</div>
              <div className="text-[14px] mt-1">As inscrições aparecerão aqui em tempo real</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[14px]">
                <thead>
                  <tr className="text-brand-muted text-left text-[12px] uppercase tracking-[0.08em]">
                    {['Bib', 'Atleta', 'Prova', 'Categoria', 'Camiseta', 'Valor', 'Pagamento', 'Status'].map(h => (
                      <th key={h} className="px-2.5 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inscritosFiltrados.map((r, i) => (
                    <tr key={i} className="border-t border-brand-lilac-mid hover:bg-brand-bg transition-colors">
                      <td className="px-2.5 py-3">
                        <span className="font-display font-bold text-brand-purple text-[15px]">
                          {r.bib_number ?? '—'}
                        </span>
                      </td>
                      <td className="px-2.5 py-3">
                        <div className="font-medium text-brand-ink">{r.nome}</div>
                        <div className="text-[11px] text-brand-muted">{r.email}</div>
                      </td>
                      <td className="px-2.5 py-3 text-brand-muted">{r.distancia} km</td>
                      <td className="px-2.5 py-3 text-brand-muted text-[13px]">{r.categoria}</td>
                      <td className="px-2.5 py-3 text-center">
                        <span className="font-display font-bold text-[13px] bg-brand-lilac text-brand-purple-dark px-2 py-0.5 rounded">
                          {r.camiseta}
                        </span>
                      </td>
                      <td className="px-2.5 py-3 font-medium">{formataBRL(r.preco_centavos ?? 0)}</td>
                      <td className="px-2.5 py-3 text-brand-muted text-[13px] capitalize">{r.pagamento ?? '—'}</td>
                      <td className="px-2.5 py-3">
                        <span className={r.status === 'confirmado' ? 'badge-status-ok' : r.status === 'pendente' ? 'badge-status-pending' : 'badge-status-pending'}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
