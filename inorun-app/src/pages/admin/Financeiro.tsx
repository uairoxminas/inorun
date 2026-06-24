// src/pages/admin/Financeiro.tsx — Controle financeiro completo do evento

import { useState, useEffect } from 'react';
import { formataBRL } from '../../lib/precoLoteAtual';
import {
  getFinanceiro, lancarFinanceiro, deletarLancamento, calcularResumoFinanceiro
} from '../../services/adminService';
import type { FinanceiroRow, ResumoFinanceiro } from '../../services/adminService';

const CATS_RECEITA = ['inscricao', 'patrocinio', 'venda_kit', 'outros_receita'];
const CATS_DESPESA = ['taxa_gateway', 'taxa_plataforma', 'material', 'logistica', 'premiacao', 'marketing', 'staff', 'outros_despesa'];
const CAT_LABEL: Record<string, string> = {
  inscricao: 'Inscrição', patrocinio: 'Patrocínio', venda_kit: 'Venda de kit', outros_receita: 'Outros (receita)',
  taxa_gateway: 'Taxa gateway', taxa_plataforma: 'Taxa de plataforma (R$5/insc.)',
  material: 'Materiais', logistica: 'Logística', premiacao: 'Premiação',
  marketing: 'Marketing', staff: 'Staff/Equipe', outros_despesa: 'Outros (despesa)',
};

interface Props { eventoId: string; }

export default function Financeiro({ eventoId }: Props) {
  const [entries, setEntries]   = useState<FinanceiroRow[]>([]);
  const [resumo, setResumo]     = useState<ResumoFinanceiro | null>(null);
  const [loading, setLoading]   = useState(true);
  const [filtro, setFiltro]     = useState<'todos' | 'receita' | 'despesa'>('todos');
  const [deletando, setDeletando] = useState<string | null>(null);

  // Form novo lançamento
  const [fTipo, setFTipo]       = useState<'receita' | 'despesa'>('receita');
  const [fCat, setFCat]         = useState('patrocinio');
  const [fDesc, setFDesc]       = useState('');
  const [fValor, setFValor]     = useState('');
  const [fData, setFData]       = useState(new Date().toISOString().slice(0, 10));
  const [salvando, setSalvando] = useState(false);
  const [fErro, setFErro]       = useState('');

  const carregar = async () => {
    setLoading(true);
    const data = await getFinanceiro(eventoId);
    setEntries(data);
    setResumo(calcularResumoFinanceiro(data));
    setLoading(false);
  };

  useEffect(() => { if (eventoId) carregar(); }, [eventoId]);

  const handleLancar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fDesc || !fValor) { setFErro('Preencha todos os campos'); return; }
    const reais = parseFloat(fValor.replace(/\./g, '').replace(',', '.'));
    if (isNaN(reais) || reais <= 0) { setFErro('Valor inválido'); return; }
    setSalvando(true);
    const res = await lancarFinanceiro(eventoId, fTipo, fCat, fDesc, Math.round(reais * 100), fData);
    if (res.ok) {
      setFDesc(''); setFValor(''); setFErro('');
      await carregar();
    } else { setFErro(res.erro ?? 'Erro'); }
    setSalvando(false);
  };

  const handleDeletar = async (id: string) => {
    if (!confirm('Excluir este lançamento?')) return;
    setDeletando(id);
    await deletarLancamento(id);
    await carregar();
    setDeletando(null);
  };

  const filtrados = filtro === 'todos' ? entries : entries.filter(e => e.tipo === filtro);

  return (
    <div className="space-y-5">
      <h2 className="font-display font-extrabold italic uppercase text-[32px] text-brand-ink leading-none">
        Controle Financeiro
      </h2>

      {/* Resumo financeiro geral */}
      {resumo && (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
          <div className="card p-5 border-green-300">
            <div className="text-[11px] text-brand-muted uppercase tracking-[0.12em]">Total receitas</div>
            <div className="font-display font-extrabold text-[28px] text-green-600 mt-1">{formataBRL(resumo.total_receitas)}</div>
          </div>
          <div className="card p-5 border-red-300">
            <div className="text-[11px] text-brand-muted uppercase tracking-[0.12em]">Total despesas</div>
            <div className="font-display font-extrabold text-[28px] text-red-500 mt-1">{formataBRL(resumo.total_despesas)}</div>
          </div>
          <div className={`card p-5 ${resumo.saldo >= 0 ? 'border-brand-purple-mid' : 'border-red-400'}`}>
            <div className="text-[11px] text-brand-muted uppercase tracking-[0.12em]">Saldo líquido</div>
            <div className={`font-display font-extrabold text-[28px] mt-1 ${resumo.saldo >= 0 ? 'text-brand-purple' : 'text-red-600'}`}>
              {resumo.saldo >= 0 ? '+' : ''}{formataBRL(Math.abs(resumo.saldo))}
            </div>
          </div>
        </div>
      )}

      {/* DRE de Inscrições — breakout da taxa de plataforma */}
      {resumo && resumo.receita_bruta_inscricoes > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">📊</span>
            <div className="font-semibold text-brand-ink">DRE de Inscrições · Taxa de Plataforma</div>
          </div>
          <div className="space-y-0 divide-y divide-brand-lilac-mid">
            {/* Receita bruta */}
            <div className="flex items-center justify-between py-3">
              <div>
                <div className="text-[14px] font-medium text-brand-ink">Receita bruta de inscrições</div>
                <div className="text-[11px] text-brand-muted">Total pago pelos atletas (sem taxa)</div>
              </div>
              <span className="font-display font-bold text-[18px] text-green-600">
                +{formataBRL(resumo.receita_bruta_inscricoes)}
              </span>
            </div>
            {/* Taxa plataforma */}
            <div className="flex items-center justify-between py-3">
              <div>
                <div className="text-[14px] font-medium text-brand-ink">Taxa de plataforma</div>
                <div className="text-[11px] text-brand-muted">
                  R$5,00 × {Math.round(resumo.taxa_plataforma_total / 500)} inscrições confirmadas
                </div>
              </div>
              <span className="font-display font-bold text-[18px] text-red-500">
                −{formataBRL(resumo.taxa_plataforma_total)}
              </span>
            </div>
            {/* Receita líquida */}
            <div className="flex items-center justify-between py-3 bg-brand-lilac/30 rounded-xl px-3">
              <div>
                <div className="text-[14px] font-bold text-brand-ink">Receita líquida de inscrições</div>
                <div className="text-[11px] text-brand-muted">O que o evento recebe após a taxa</div>
              </div>
              <span className="font-display font-extrabold text-[22px] text-brand-purple">
                {formataBRL(resumo.receita_liquida_inscricoes)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Por categoria */}
      {resumo && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card p-5">
            <div className="font-semibold text-brand-ink mb-3">Receitas por categoria</div>
            {Object.entries(resumo.por_categoria_receita).length === 0 ? (
              <p className="text-brand-muted text-[13px]">Nenhuma receita ainda</p>
            ) : Object.entries(resumo.por_categoria_receita).map(([cat, val]) => (
              <div key={cat} className="flex justify-between py-2 border-b border-brand-lilac-mid last:border-0">
                <span className="text-[13px] text-brand-ink">{CAT_LABEL[cat] ?? cat}</span>
                <span className="font-medium text-green-600">{formataBRL(val)}</span>
              </div>
            ))}
          </div>
          <div className="card p-5">
            <div className="font-semibold text-brand-ink mb-3">Despesas por categoria</div>
            {Object.entries(resumo.por_categoria_despesa).length === 0 ? (
              <p className="text-brand-muted text-[13px]">Nenhuma despesa ainda</p>
            ) : Object.entries(resumo.por_categoria_despesa).map(([cat, val]) => (
              <div key={cat} className="flex justify-between py-2 border-b border-brand-lilac-mid last:border-0">
                <span className="text-[13px] text-brand-ink">{CAT_LABEL[cat] ?? cat}</span>
                <span className="font-medium text-red-500">{formataBRL(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Novo lançamento */}
      <div className="card p-5">
        <h3 className="font-semibold text-brand-ink mb-4">Lançar entrada manual</h3>
        <form onSubmit={handleLancar} className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">Tipo</label>
            <div className="flex gap-2">
              {(['receita', 'despesa'] as const).map(t => (
                <button key={t} type="button"
                  onClick={() => { setFTipo(t); setFCat(t === 'receita' ? 'patrocinio' : 'taxa_gateway'); }}
                  className={`flex-1 py-2.5 rounded-xl border-2 font-semibold text-[14px] capitalize transition-all ${
                    fTipo === t
                      ? t === 'receita' ? 'bg-green-600 text-white border-green-600' : 'bg-red-500 text-white border-red-500'
                      : 'bg-white text-brand-muted border-brand-lilac-mid hover:border-brand-purple'
                  }`}>{t === 'receita' ? '↑ Receita' : '↓ Despesa'}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Categoria</label>
            <select className="input" value={fCat} onChange={e => setFCat(e.target.value)}>
              {(fTipo === 'receita' ? CATS_RECEITA : CATS_DESPESA).map(c => (
                <option key={c} value={c}>{CAT_LABEL[c]}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Descrição</label>
            <input id="input-fin-desc" className="input" value={fDesc}
              onChange={e => setFDesc(e.target.value)} placeholder="Ex: Patrocínio Hidrata+" />
          </div>
          <div>
            <label className="label">Valor (R$)</label>
            <input id="input-fin-valor" className="input" value={fValor}
              onChange={e => setFValor(e.target.value)} placeholder="1.500,00" />
          </div>
          <div>
            <label className="label">Data</label>
            <input type="date" className="input" value={fData} onChange={e => setFData(e.target.value)} />
          </div>
          {fErro && <p className="md:col-span-2 text-red-500 text-[13px]">{fErro}</p>}
          <div className="md:col-span-2">
            <button id="btn-lancar-financeiro" type="submit" disabled={salvando}
              className="btn-primary py-2.5 px-6 text-[14px]">
              {salvando ? 'Lançando...' : '+ Lançar'}
            </button>
          </div>
        </form>
      </div>

      {/* Extrato */}
      <div className="card">
        <div className="p-5 flex items-center justify-between flex-wrap gap-2 border-b border-brand-lilac-mid">
          <div className="font-semibold text-brand-ink">Extrato ({filtrados.length})</div>
          <div className="flex gap-2">
            {(['todos', 'receita', 'despesa'] as const).map(f => (
              <button key={f} onClick={() => setFiltro(f)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all capitalize ${
                  filtro === f ? 'bg-brand-purple text-white' : 'bg-brand-lilac text-brand-muted hover:text-brand-ink'
                }`}>{f}</button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-5 space-y-2">{[0,1,2].map(i => <div key={i} className="h-10 bg-brand-lilac rounded animate-pulse" />)}</div>
          ) : filtrados.length === 0 ? (
            <div className="p-8 text-center text-brand-muted">Nenhum lançamento</div>
          ) : filtrados.map(e => (
            <div key={e.id}
              className="flex items-center justify-between px-5 py-3.5 border-b border-brand-lilac-mid last:border-0 hover:bg-brand-bg transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${e.tipo === 'receita' ? 'bg-green-500' : 'bg-red-400'}`} />
                <div>
                  <div className="text-[14px] font-medium text-brand-ink">{e.descricao}</div>
                  <div className="text-[11px] text-brand-muted">
                    {CAT_LABEL[e.categoria] ?? e.categoria} · {new Date(e.data_lancamento).toLocaleDateString('pt-BR')}
                    {e.automatico && <span className="ml-1 bg-brand-lilac text-brand-purple-dark px-1.5 rounded text-[10px]">auto</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-display font-bold text-[16px] ${e.tipo === 'receita' ? 'text-green-600' : 'text-red-500'}`}>
                  {e.tipo === 'receita' ? '+' : '−'}{formataBRL(e.valor_centavos)}
                </span>
                {!e.automatico && (
                  <button id={`deletar-lancamento-${e.id}`}
                    disabled={deletando === e.id}
                    onClick={() => handleDeletar(e.id)}
                    className="text-red-400 hover:text-red-600 text-[18px] transition-colors">
                    {deletando === e.id ? '...' : '×'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
