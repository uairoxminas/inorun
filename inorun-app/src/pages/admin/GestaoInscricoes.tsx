// src/pages/admin/GestaoInscricoes.tsx — Gestão de inscrições com drawer do atleta

import { useState } from 'react';
import { formataBRL } from '../../lib/precoLoteAtual';
import { cancelarInscricao, gerarCSV } from '../../services/adminService';
import type { InscritoRow } from '../../services/adminService';

interface Props { inscritos: InscritoRow[]; onRecarregar: () => void; loading: boolean; }

function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    confirmado: 'bg-green-100 text-green-700 border-green-300',
    pendente:   'bg-yellow-100 text-yellow-700 border-yellow-300',
    cancelado:  'bg-red-100 text-red-600 border-red-300',
  };
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${map[status] ?? 'bg-brand-lilac text-brand-muted border-brand-lilac-mid'}`}>
      {status}
    </span>
  );
}

export default function GestaoInscricoes({ inscritos, onRecarregar, loading }: Props) {
  const [busca, setBusca]               = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroProva, setFiltroProva]   = useState('todos');
  const [atleta, setAtleta]             = useState<InscritoRow | null>(null);
  const [cancelando, setCancelando]     = useState(false);
  const [pag, setPag]                   = useState(1);
  const POR_PAG = 20;

  const filtrados = inscritos.filter(r => {
    const matchB = !busca ||
      r.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      r.email?.toLowerCase().includes(busca.toLowerCase()) ||
      String(r.bib_number ?? '').includes(busca) ||
      r.categoria?.toLowerCase().includes(busca.toLowerCase());
    const matchS = filtroStatus === 'todos' || r.status === filtroStatus;
    const matchP = filtroProva  === 'todos' || String(r.distancia) === filtroProva;
    return matchB && matchS && matchP;
  });

  const paginas = Math.ceil(filtrados.length / POR_PAG);
  const paginados = filtrados.slice((pag - 1) * POR_PAG, pag * POR_PAG);

  const handleExport = () => {
    const csv  = gerarCSV(filtrados);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `inorun-inscritos-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleCancelar = async () => {
    if (!atleta || !confirm(`Cancelar inscrição de ${atleta.nome}?`)) return;
    setCancelando(true);
    const { ok } = await cancelarInscricao(atleta.registration_id);
    if (ok) { onRecarregar(); setAtleta(null); }
    setCancelando(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-display font-extrabold italic uppercase text-[32px] text-brand-ink leading-none">
          Inscrições
        </h2>
        <button id="btn-exportar-csv-inscricoes" onClick={handleExport}
          className="btn-primary text-[13px] py-2 px-4">
          Exportar CSV ({filtrados.length})
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <input id="busca-admin-inscritos" value={busca} onChange={e => { setBusca(e.target.value); setPag(1); }}
          className="input text-[13px] py-2 w-52" placeholder="Buscar nome, bib, e-mail..." />
        <select value={filtroStatus} onChange={e => { setFiltroStatus(e.target.value); setPag(1); }}
          className="input text-[13px] py-2 w-36">
          <option value="todos">Todos status</option>
          <option value="confirmado">Confirmados</option>
          <option value="pendente">Pendentes</option>
          <option value="cancelado">Cancelados</option>
        </select>
        <select value={filtroProva} onChange={e => { setFiltroProva(e.target.value); setPag(1); }}
          className="input text-[13px] py-2 w-28">
          <option value="todos">Todas provas</option>
          <option value="5">5 km</option>
          <option value="10">10 km</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="card overflow-x-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {[0,1,2].map(i => <div key={i} className="h-10 bg-brand-lilac rounded animate-pulse" />)}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="p-10 text-center text-brand-muted">
            <div className="text-3xl mb-2">🔍</div>
            Nenhum inscrito encontrado
          </div>
        ) : (
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr className="text-brand-muted text-[11px] uppercase tracking-[0.08em] bg-brand-bg">
                {['Bib','Atleta','Prova','Cat.','Camiseta','Valor','Check-in','Status'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginados.map((r, i) => (
                <tr key={i}
                  onClick={() => setAtleta(r)}
                  className="border-t border-brand-lilac-mid hover:bg-brand-lilac/40 cursor-pointer transition-colors">
                  <td className="px-3 py-2.5">
                    <span className="font-display font-bold text-brand-purple text-[14px]">{r.bib_number ?? '—'}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-brand-ink">{r.nome}</div>
                    <div className="text-[11px] text-brand-muted">{r.email}</div>
                  </td>
                  <td className="px-3 py-2.5 text-brand-muted">{r.distancia} km</td>
                  <td className="px-3 py-2.5 text-[12px] text-brand-muted">{r.categoria}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="font-display font-bold text-[12px] bg-brand-lilac text-brand-purple-dark px-2 py-0.5 rounded">
                      {r.camiseta}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[13px]">{formataBRL(r.preco_centavos ?? 0)}</td>
                  <td className="px-3 py-2.5 text-center">
                    {r.checked_in_at
                      ? <span className="text-green-600 text-[13px]">✓ {new Date(r.checked_in_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      : <span className="text-brand-muted text-[12px]">—</span>}
                  </td>
                  <td className="px-3 py-2.5"><Badge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginação */}
      {paginas > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={pag === 1} onClick={() => setPag(p => p - 1)} className="btn-ghost text-[13px]">← Anterior</button>
          <span className="text-[13px] text-brand-muted">{pag} / {paginas}</span>
          <button disabled={pag === paginas} onClick={() => setPag(p => p + 1)} className="btn-ghost text-[13px]">Próxima →</button>
        </div>
      )}

      {/* Drawer do atleta */}
      {atleta && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setAtleta(null)} />
          <div className="w-full max-w-[420px] bg-white shadow-2xl overflow-y-auto animate-slide-in-right">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display font-extrabold italic uppercase text-[22px] text-brand-ink">Ficha do Atleta</h3>
                <button onClick={() => setAtleta(null)} className="text-brand-muted hover:text-brand-ink text-[22px] leading-none">×</button>
              </div>

              {/* Bib destaque */}
              {atleta.bib_number && (
                <div className="bg-gradient-brand rounded-xl p-4 text-center mb-5">
                  <div className="text-white/70 text-[11px] uppercase tracking-[0.15em]">Número de peito</div>
                  <div className="font-display font-extrabold text-[56px] text-brand-yellow leading-none">{atleta.bib_number}</div>
                </div>
              )}

              {/* Dados */}
              <div className="space-y-3">
                {[
                  ['Nome', atleta.nome],
                  ['E-mail', atleta.email],
                  ['CPF', atleta.cpf ? atleta.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '—'],
                  ['Sexo', atleta.sexo === 'M' ? 'Masculino' : 'Feminino'],
                  ['Prova', `${atleta.distancia} km`],
                  ['Categoria', atleta.categoria],
                  ['Camiseta', atleta.camiseta],
                  ['Lote', atleta.lote ?? '—'],
                  ['Valor pago', formataBRL(atleta.preco_centavos ?? 0)],
                  ['Pagamento', atleta.pagamento ?? '—'],
                  ['Status pgto', atleta.pag_status ?? '—'],
                  ['Check-in', atleta.checked_in_at
                    ? `✅ ${new Date(atleta.checked_in_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
                    : '❌ Não realizado'],
                  ['Inscrito em', new Date(atleta.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2 border-b border-brand-lilac-mid last:border-0">
                    <span className="text-[12px] text-brand-muted uppercase tracking-[0.08em]">{k}</span>
                    <span className="text-[14px] text-brand-ink font-medium text-right max-w-[240px]">{v}</span>
                  </div>
                ))}
              </div>

              {/* Ações */}
              {atleta.status !== 'cancelado' && (
                <button id="btn-cancelar-inscricao" onClick={handleCancelar}
                  disabled={cancelando}
                  className="w-full mt-6 py-3 rounded-xl border-2 border-red-400 text-red-600 font-semibold text-[14px] hover:bg-red-50 transition-colors disabled:opacity-50">
                  {cancelando ? 'Cancelando...' : '⚠️ Cancelar inscrição'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
