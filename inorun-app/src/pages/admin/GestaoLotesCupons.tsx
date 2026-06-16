// src/pages/admin/GestaoLotesCupons.tsx — Gestão de lotes e cupons

import { useState, useEffect } from 'react';
import { formataBRL } from '../../lib/precoLoteAtual';
import {
  getLotes, toggleLote, getCupons, criarCupom, toggleCupom
} from '../../services/adminService';
import type { LoteRow, CupomRow } from '../../services/adminService';

export default function GestaoLotesCupons() {
  const [lotes, setLotes]       = useState<LoteRow[]>([]);
  const [cupons, setCupons]     = useState<CupomRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [aba, setAba]           = useState<'lotes' | 'cupons'>('lotes');
  const [salvando, setSalvando] = useState<string | null>(null);

  // Form novo cupom
  const [fCodigo, setFCodigo]   = useState('');
  const [fTipo, setFTipo]       = useState<'percentual' | 'fixo'>('percentual');
  const [fValor, setFValor]     = useState('');
  const [fValidade, setFValidade] = useState('2026-10-11');
  const [fErro, setFErro]       = useState('');
  const [criando, setCriando]   = useState(false);

  const carregar = async () => {
    setLoading(true);
    const [ls, cs] = await Promise.all([getLotes(), getCupons()]);
    setLotes(ls); setCupons(cs);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const handleToggleLote = async (lot_id: string, ativo: boolean) => {
    setSalvando(lot_id);
    await toggleLote(lot_id, !ativo);
    await carregar();
    setSalvando(null);
  };

  const handleCriarCupom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fCodigo || !fValor) { setFErro('Preencha todos os campos'); return; }
    const val = parseFloat(fValor.replace(',', '.'));
    if (isNaN(val) || val <= 0) { setFErro('Valor inválido'); return; }
    setCriando(true);
    const res = await criarCupom(fCodigo, fTipo, val, fValidade);
    if (res.ok) {
      setFCodigo(''); setFValor(''); setFErro('');
      await carregar();
    } else {
      setFErro(res.erro ?? 'Erro ao criar cupom');
    }
    setCriando(false);
  };

  const handleToggleCupom = async (id: string, ativo: boolean) => {
    setSalvando(id);
    await toggleCupom(id, !ativo);
    await carregar();
    setSalvando(null);
  };

  return (
    <div className="space-y-5">
      <h2 className="font-display font-extrabold italic uppercase text-[32px] text-brand-ink leading-none">
        Lotes & Cupons
      </h2>

      {/* Abas */}
      <div className="flex gap-2 border-b border-brand-lilac-mid">
        {(['lotes', 'cupons'] as const).map(a => (
          <button key={a} id={`aba-${a}`}
            onClick={() => setAba(a)}
            className={`px-5 py-3 text-[14px] font-semibold capitalize transition-all duration-150
              ${aba === a ? 'text-brand-purple border-b-2 border-brand-purple' : 'text-brand-muted hover:text-brand-ink'}`}>
            {a === 'lotes' ? 'Gestão de Lotes' : 'Cupons de Desconto'}
          </button>
        ))}
      </div>

      {/* ── LOTES ── */}
      {aba === 'lotes' && (
        <div className="space-y-4">
          <div className="bg-brand-lilac rounded-xl px-4 py-3 text-[13px] text-brand-purple-dark">
            <strong>Automático:</strong> o lote ativo é calculado pelas datas de início e fim.
            Use o toggle para <strong>forçar ativação/desativação manual</strong> — ao ativar manualmente,
            o lote fica aberto até 10/10/2026. Ao desativar, fecha imediatamente.
          </div>

          {loading ? (
            <div className="space-y-3">{[0,1,2,3,4,5].map(i => <div key={i} className="h-16 bg-brand-lilac rounded-xl animate-pulse" />)}</div>
          ) : (
            <div className="space-y-3">
              {['5 km', '10 km'].map(prova => (
                <div key={prova}>
                  <h3 className="font-display font-bold text-[18px] text-brand-ink mb-2">{prova}</h3>
                  <div className="space-y-2">
                    {lotes.filter(l => l.prova?.includes(prova.replace(' km', 'km')) || l.prova === prova).map(l => (
                      <div key={l.id} className={`card p-4 flex items-center justify-between gap-4 transition-all ${l.ativo ? 'border-green-300 bg-green-50' : ''}`}>
                        <div>
                          <div className="font-semibold text-brand-ink">{l.nome}</div>
                          <div className="text-[12px] text-brand-muted mt-0.5">
                            {formataBRL(l.preco_centavos)} · {new Date(l.abre_em).toLocaleDateString('pt-BR')} – {new Date(l.fecha_em).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {l.ativo ? (
                            <span className="badge-lot-active text-[11px]">● Ativo</span>
                          ) : (
                            <span className="text-[11px] text-brand-muted bg-brand-lilac-mid px-2 py-0.5 rounded-full">Inativo</span>
                          )}
                          <button id={`toggle-lote-${l.id}`}
                            disabled={salvando === l.id}
                            onClick={() => handleToggleLote(l.id, l.ativo)}
                            className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${l.ativo ? 'bg-brand-purple' : 'bg-brand-lilac-mid'}`}>
                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${l.ativo ? 'translate-x-6' : 'translate-x-0.5'}`} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {lotes.filter(l => l.prova?.includes(prova.replace(' km', 'km')) || l.prova === prova).length === 0 && (
                      <p className="text-brand-muted text-[13px] p-3">Nenhum lote para {prova}</p>
                    )}
                  </div>
                </div>
              ))}

              {/* Fallback: todos os lotes se não houver prova */}
              {lotes.filter(l => !['5 km','10 km'].some(p => l.prova?.includes(p.replace(' km', 'km')) || l.prova === p)).map(l => (
                <div key={l.id} className={`card p-4 flex items-center justify-between gap-4 ${l.ativo ? 'border-green-300 bg-green-50' : ''}`}>
                  <div>
                    <div className="font-semibold text-brand-ink">{l.nome} <span className="text-brand-muted text-[12px]">— {l.prova}</span></div>
                    <div className="text-[12px] text-brand-muted mt-0.5">
                      {formataBRL(l.preco_centavos)} · {new Date(l.abre_em).toLocaleDateString('pt-BR')} – {new Date(l.fecha_em).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <button disabled={salvando === l.id}
                    onClick={() => handleToggleLote(l.id, l.ativo)}
                    className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${l.ativo ? 'bg-brand-purple' : 'bg-brand-lilac-mid'}`}>
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${l.ativo ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CUPONS ── */}
      {aba === 'cupons' && (
        <div className="space-y-5">
          {/* Criar cupom */}
          <div className="card p-5">
            <h3 className="font-semibold text-brand-ink mb-4">Criar novo cupom</h3>
            <form onSubmit={handleCriarCupom} className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label">Código</label>
                <input id="input-cupom-codigo" className="input" value={fCodigo}
                  onChange={e => setFCodigo(e.target.value.toUpperCase())}
                  placeholder="Ex: INO10" />
              </div>
              <div>
                <label className="label">Tipo</label>
                <select className="input" value={fTipo} onChange={e => setFTipo(e.target.value as 'percentual' | 'fixo')}>
                  <option value="percentual">Percentual (%)</option>
                  <option value="fixo">Valor fixo (R$)</option>
                </select>
              </div>
              <div>
                <label className="label">{fTipo === 'percentual' ? 'Desconto (%)' : 'Desconto (R$)'}</label>
                <input id="input-cupom-valor" className="input" value={fValor}
                  onChange={e => setFValor(e.target.value)} placeholder={fTipo === 'percentual' ? '10' : '15,00'} />
              </div>
              <div>
                <label className="label">Validade</label>
                <input type="date" className="input" value={fValidade}
                  onChange={e => setFValidade(e.target.value)} />
              </div>
              {fErro && <p className="md:col-span-2 text-red-500 text-[13px]">{fErro}</p>}
              <div className="md:col-span-2">
                <button id="btn-criar-cupom" type="submit" disabled={criando}
                  className="btn-primary py-2.5 px-6 text-[14px]">
                  {criando ? 'Criando...' : '+ Criar cupom'}
                </button>
              </div>
            </form>
          </div>

          {/* Lista de cupons */}
          <div className="card overflow-x-auto">
            {loading ? (
              <div className="p-5 space-y-3">{[0,1,2].map(i => <div key={i} className="h-10 bg-brand-lilac rounded animate-pulse" />)}</div>
            ) : cupons.length === 0 ? (
              <div className="p-8 text-center text-brand-muted">Nenhum cupom cadastrado</div>
            ) : (
              <table className="w-full border-collapse text-[14px]">
                <thead>
                  <tr className="text-brand-muted text-[11px] uppercase tracking-[0.08em] bg-brand-bg">
                    {['Código','Tipo','Desconto','Validade','Usos','Status','Ação'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cupons.map(c => (
                    <tr key={c.id} className="border-t border-brand-lilac-mid">
                      <td className="px-3 py-2.5">
                        <span className="font-display font-bold text-brand-purple">{c.codigo}</span>
                      </td>
                      <td className="px-3 py-2.5 text-brand-muted capitalize">{c.tipo}</td>
                      <td className="px-3 py-2.5 font-medium">
                        {c.tipo === 'percentual' ? `${c.valor}%` : formataBRL(c.valor * 100)}
                      </td>
                      <td className="px-3 py-2.5 text-brand-muted">{new Date(c.validade).toLocaleDateString('pt-BR')}</td>
                      <td className="px-3 py-2.5 text-center font-bold text-brand-purple">{c.usos}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${c.ativo ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-50 text-red-500 border-red-200'}`}>
                          {c.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <button id={`toggle-cupom-${c.id}`}
                          disabled={salvando === c.id}
                          onClick={() => handleToggleCupom(c.id, c.ativo)}
                          className={`text-[12px] px-3 py-1 rounded-lg font-medium transition-colors ${c.ativo ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                          {salvando === c.id ? '...' : c.ativo ? 'Desativar' : 'Ativar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
