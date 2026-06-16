// src/pages/admin/AdminDashboard.tsx — Dashboard expandido com Realtime

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { formataBRL } from '../../lib/precoLoteAtual';
import type { MetricasAdmin, InscritoRow } from '../../services/adminService';

interface Props {
  metricas: MetricasAdmin;
  inscritos: InscritoRow[];
  onRecarregar: () => void;
  loading: boolean;
}

function MCard({ label, value, sub, cor = 'purple', icon }: {
  label: string; value: string | number; sub?: string; cor?: string; icon?: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] text-brand-muted tracking-[0.12em] uppercase font-medium">{label}</div>
          <div className={`font-display font-extrabold text-[30px] mt-1 leading-none ${
            cor === 'purple' ? 'text-brand-purple' :
            cor === 'green'  ? 'text-green-600'   :
            cor === 'yellow' ? 'text-brand-yellow-dark' :
            'text-red-500'
          }`}>{value}</div>
          {sub && <div className="text-[11px] text-brand-muted mt-1">{sub}</div>}
        </div>
        {icon && <span className="text-2xl opacity-70">{icon}</span>}
      </div>
    </div>
  );
}

export default function AdminDashboard({ metricas, onRecarregar, loading }: Props) {
  const [ultimoUpdate, setUltimoUpdate] = useState(new Date());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Supabase Realtime — atualiza quando chega nova inscrição
  useEffect(() => {
    channelRef.current = supabase.channel('admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registration' }, () => {
        onRecarregar();
        setUltimoUpdate(new Date());
      })
      .subscribe();

    return () => { channelRef.current?.unsubscribe(); };
  }, []);

  const camisetas = ['PP', 'P', 'M', 'G', 'GG', 'XG'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-extrabold italic uppercase text-[32px] text-brand-ink leading-none">
            Dashboard
          </h2>
          <p className="text-[12px] text-brand-muted mt-1">
            {loading ? '⏳ Atualizando...' : `Atualizado às ${ultimoUpdate.toLocaleTimeString('pt-BR')}`}
            {' · '}<span className="text-green-600">● Realtime ativo</span>
          </p>
        </div>
        <button onClick={() => { onRecarregar(); setUltimoUpdate(new Date()); }}
          disabled={loading} className="btn-ghost text-[13px]">
          {loading ? '↺ ...' : '↺ Atualizar'}
        </button>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MCard label="Total inscritos"  value={metricas.total} sub="todas as provas" cor="purple" icon="🏃" />
        <MCard label="Confirmados"      value={metricas.confirmados} sub="pagto confirmado" cor="green" icon="✅" />
        <MCard label="Receita"          value={formataBRL(metricas.receita_centavos)} sub="pagtos confirmados" cor="purple" icon="💰" />
        <MCard label="Pendentes"        value={metricas.pendentes} sub="aguardando pagto" cor="yellow" icon="⏳" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MCard label="Check-ins feitos" value={metricas.checkins} sub={`de ${metricas.confirmados} confirmados`} cor="green" icon="📋" />
        <MCard label="Cancelados"       value={metricas.cancelados} sub="inscrições canceladas" cor="red" icon="❌" />
        <MCard label="5 km"             value={metricas.inscritos_5km} sub={`de ${metricas.vagas_5km} vagas`} cor="purple" icon="🔵" />
        <MCard label="10 km"            value={metricas.inscritos_10km} sub={`de ${metricas.vagas_10km} vagas`} cor="purple" icon="🟣" />
      </div>

      {/* Vagas por prova */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <div className="font-semibold text-brand-ink mb-4">Ocupação de vagas</div>
          {[
            { label: '5 km',  count: metricas.inscritos_5km,  vagas: metricas.vagas_5km },
            { label: '10 km', count: metricas.inscritos_10km, vagas: metricas.vagas_10km },
          ].map(p => (
            <div key={p.label} className="mb-4">
              <div className="flex justify-between text-[13px] mb-1.5">
                <span className="font-medium">{p.label}</span>
                <span className="text-brand-muted">{p.count}/{p.vagas} ({Math.round((p.count/p.vagas)*100)}%)</span>
              </div>
              <div className="h-3 bg-brand-lilac rounded-full overflow-hidden">
                <div className="h-full bg-gradient-brand-h rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, (p.count/p.vagas)*100)}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Status breakdown */}
        <div className="card p-5">
          <div className="font-semibold text-brand-ink mb-4">Status das inscrições</div>
          {[
            { label: 'Confirmados', count: metricas.confirmados, cor: 'bg-green-500' },
            { label: 'Pendentes',   count: metricas.pendentes,   cor: 'bg-yellow-400' },
            { label: 'Cancelados',  count: metricas.cancelados,  cor: 'bg-red-400' },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between py-2.5 border-b border-brand-lilac-mid last:border-0">
              <div className="flex items-center gap-2.5">
                <div className={`w-3 h-3 rounded-full ${s.cor}`} />
                <span className="text-[14px] text-brand-ink">{s.label}</span>
              </div>
              <span className="font-display font-bold text-[20px] text-brand-purple">{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Camisetas */}
      <div className="card p-5">
        <div className="font-semibold text-brand-ink mb-4">Distribuição de camisetas</div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr className="text-brand-muted text-[11px] uppercase tracking-[0.1em]">
                <th className="text-left px-3 py-2">Tamanho</th>
                <th className="text-center px-3 py-2">5 km</th>
                <th className="text-center px-3 py-2">10 km</th>
                <th className="text-center px-3 py-2 font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {camisetas.map(c => {
                const d = metricas.por_camiseta[c] ?? { total: 0, km5: 0, km10: 0 };
                return (
                  <tr key={c} className="border-t border-brand-lilac-mid">
                    <td className="px-3 py-2.5">
                      <span className="font-display font-bold text-[15px] bg-brand-lilac text-brand-purple-dark px-3 py-0.5 rounded">{c}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-brand-muted">{d.km5}</td>
                    <td className="px-3 py-2.5 text-center text-brand-muted">{d.km10}</td>
                    <td className="px-3 py-2.5 text-center font-bold text-brand-purple">{d.total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Por lote */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <div className="font-semibold text-brand-ink mb-4">Inscrições por lote</div>
          {Object.entries(metricas.por_lote).length === 0 ? (
            <p className="text-brand-muted text-[14px]">Nenhum dado ainda</p>
          ) : Object.entries(metricas.por_lote).map(([lote, qtd]) => (
            <div key={lote} className="flex justify-between py-2 border-b border-brand-lilac-mid last:border-0">
              <span className="text-[14px] text-brand-ink">{lote}</span>
              <span className="font-bold text-brand-purple">{qtd}</span>
            </div>
          ))}
        </div>

        {/* Evolução por dia */}
        <div className="card p-5">
          <div className="font-semibold text-brand-ink mb-4">Evolução (últimos dias)</div>
          {metricas.por_dia.length === 0 ? (
            <p className="text-brand-muted text-[14px]">Nenhum dado ainda</p>
          ) : (
            <div className="flex items-end gap-1.5 h-32">
              {metricas.por_dia.slice(-14).map(({ data, total }) => {
                const max = Math.max(...metricas.por_dia.map(d => d.total), 1);
                const pct = (total / max) * 100;
                return (
                  <div key={data} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-brand-muted">{total}</span>
                    <div className="w-full bg-brand-purple rounded-t-sm transition-all duration-700"
                      style={{ height: `${Math.max(4, pct)}%` }} />
                    <span className="text-[9px] text-brand-muted rotate-45 origin-left"
                      style={{ writingMode: 'horizontal-tb' }}>
                      {data.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
