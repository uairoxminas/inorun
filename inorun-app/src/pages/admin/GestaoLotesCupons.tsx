// src/pages/admin/GestaoLotesCupons.tsx — Gestão completa de lotes e cupons

import { useState, useEffect } from 'react';
import { formataBRL } from '../../lib/precoLoteAtual';
import {
  getLotes, toggleLote, salvarLote, deletarLote,
  getCupons, criarCupom, toggleCupom
} from '../../services/adminService';
import type { LoteRow, CupomRow } from '../../services/adminService';
import { supabase } from '../../lib/supabase';

// Formata datetime para input datetime-local
const toLocalInput = (iso: string) => {
  try { return new Date(iso).toISOString().slice(0, 16); }
  catch { return ''; }
};

interface LoteForm {
  id?: string;
  race_id: string;
  nome: string;
  preco_reais: string;
  abre_em: string;
  fecha_em: string;
  ordem: string;
}

const LOTE_VAZIO: LoteForm = {
  race_id: '', nome: '', preco_reais: '', abre_em: '', fecha_em: '', ordem: '',
};

export default function GestaoLotesCupons() {
  const [lotes, setLotes]         = useState<LoteRow[]>([]);
  const [cupons, setCupons]       = useState<CupomRow[]>([]);
  const [races, setRaces]         = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading]     = useState(true);
  const [aba, setAba]             = useState<'lotes' | 'cupons'>('lotes');
  const [salvando, setSalvando]   = useState<string | null>(null);

  // Form de lote (criar/editar)
  const [loteForm, setLoteForm]   = useState<LoteForm | null>(null);
  const [loteErro, setLoteErro]   = useState('');
  const [loteOk, setLoteOk]       = useState('');

  // Form novo cupom
  const [fCodigo, setFCodigo]     = useState('');
  const [fTipo, setFTipo]         = useState<'percentual' | 'fixo'>('percentual');
  const [fValor, setFValor]       = useState('');
  const [fValidade, setFValidade] = useState('2026-10-11');
  const [fErro, setFErro]         = useState('');
  const [criando, setCriando]     = useState(false);

  const carregar = async () => {
    setLoading(true);
    const [ls, cs, { data: rs }] = await Promise.all([
      getLotes(),
      getCupons(),
      supabase.from('race').select('id,label').order('distancia_km'),
    ]);
    setLotes(ls);
    setCupons(cs);
    setRaces(rs ?? []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  // ── Lotes ────────────────────────────────────────────────────────────────

  const abrirNovoLote = () => {
    setLoteErro(''); setLoteOk('');
    setLoteForm({ ...LOTE_VAZIO, race_id: races[0]?.id ?? '' });
  };

  const abrirEditarLote = (l: LoteRow) => {
    setLoteErro(''); setLoteOk('');
    setLoteForm({
      id:         l.id,
      race_id:    l.race_id,
      nome:       l.nome,
      preco_reais: (l.preco_centavos / 100).toFixed(2).replace('.', ','),
      abre_em:    toLocalInput(l.abre_em),
      fecha_em:   toLocalInput(l.fecha_em),
      ordem:      String(l.ordem),
    });
  };

  const handleSalvarLote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loteForm) return;
    setLoteErro('');

    const preco = parseFloat((loteForm.preco_reais || '0').replace(/\./g, '').replace(',', '.'));
    if (isNaN(preco) || preco <= 0) { setLoteErro('Preço inválido'); return; }
    if (!loteForm.nome || !loteForm.abre_em || !loteForm.fecha_em) {
      setLoteErro('Preencha todos os campos obrigatórios'); return;
    }
    if (!loteForm.id && !loteForm.race_id) { setLoteErro('Selecione a prova'); return; }

    setSalvando('form');
    const res = await salvarLote({
      id:              loteForm.id,
      race_id:         loteForm.id ? undefined : loteForm.race_id,
      nome:            loteForm.nome,
      preco_centavos:  Math.round(preco * 100),
      abre_em:         new Date(loteForm.abre_em).toISOString(),
      fecha_em:        new Date(loteForm.fecha_em).toISOString(),
      ordem:           parseInt(loteForm.ordem) || undefined,
    });

    if (res.ok) {
      setLoteForm(null);
      setLoteOk(loteForm.id ? 'Lote atualizado!' : 'Lote criado!');
      await carregar();
      setTimeout(() => setLoteOk(''), 3000);
    } else {
      setLoteErro(res.erro ?? 'Erro ao salvar');
    }
    setSalvando(null);
  };

  const handleToggleLote = async (lot_id: string, ativo: boolean) => {
    setSalvando(lot_id);
    await toggleLote(lot_id, !ativo);
    await carregar();
    setSalvando(null);
  };

  const handleDeletarLote = async (l: LoteRow) => {
    if (!confirm(`Deletar o lote "${l.nome}"? Esta ação não pode ser desfeita.`)) return;
    setSalvando(l.id);
    const res = await deletarLote(l.id);
    if (!res.ok) {
      alert(res.erro ?? 'Erro ao deletar lote');
    } else {
      await carregar();
    }
    setSalvando(null);
  };

  // ── Cupons ───────────────────────────────────────────────────────────────

  const handleCriarCupom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fCodigo || !fValor) { setFErro('Preencha todos os campos'); return; }
    const val = parseFloat(fValor.replace(',', '.'));
    if (isNaN(val) || val <= 0) { setFErro('Valor inválido'); return; }
    setCriando(true);
    const res = await criarCupom(fCodigo, fTipo, val, fValidade);
    if (res.ok) { setFCodigo(''); setFValor(''); setFErro(''); await carregar(); }
    else setFErro(res.erro ?? 'Erro ao criar cupom');
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
          <button key={a} id={`aba-${a}`} onClick={() => setAba(a)}
            className={`px-5 py-3 text-[14px] font-semibold capitalize transition-all duration-150
              ${aba === a ? 'text-brand-purple border-b-2 border-brand-purple' : 'text-brand-muted hover:text-brand-ink'}`}>
            {a === 'lotes' ? 'Lotes de inscrição' : 'Cupons de desconto'}
          </button>
        ))}
      </div>

      {/* ── ABA LOTES ── */}
      {aba === 'lotes' && (
        <div className="space-y-4">
          {/* Feedback global */}
          {loteOk && (
            <div className="bg-green-50 border border-green-300 rounded-xl px-4 py-3 text-green-700 text-[13px] font-medium">
              ✅ {loteOk}
            </div>
          )}

          <div className="bg-brand-lilac rounded-xl px-4 py-3 text-[13px] text-brand-purple-dark">
            <strong>Automático:</strong> o lote ativo é calculado pelas datas de abertura e fechamento.
            Use os botões de toggle para forçar ativação/desativação manual, ou edite as datas diretamente.
          </div>

          {/* Botão novo lote */}
          <div className="flex justify-end">
            <button id="btn-novo-lote" onClick={abrirNovoLote}
              className="btn-primary text-[13px] py-2 px-5">
              + Novo lote
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">{[0,1,2,3].map(i => <div key={i} className="h-16 bg-brand-lilac rounded-xl animate-pulse" />)}</div>
          ) : (
            <div className="space-y-2">
              {lotes.map(l => (
                <div key={l.id} className={`card p-4 transition-all ${l.ativo ? 'border-green-300 bg-green-50/50' : ''}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-brand-ink">{l.nome}</span>
                        <span className="text-[11px] text-brand-muted bg-brand-lilac px-2 py-0.5 rounded">{l.prova}</span>
                        {l.ativo
                          ? <span className="badge-lot-active text-[11px]">● Ativo agora</span>
                          : <span className="text-[11px] text-brand-muted bg-brand-lilac-mid px-2 py-0.5 rounded-full">Inativo</span>
                        }
                      </div>
                      <div className="text-[12px] text-brand-muted mt-1">
                        <span className="font-semibold text-brand-purple">{formataBRL(l.preco_centavos)}</span>
                        {' · '}Abre: {new Date(l.abre_em).toLocaleDateString('pt-BR')} {' '}{new Date(l.abre_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        {' · '}Fecha: {new Date(l.fecha_em).toLocaleDateString('pt-BR')} {' '}{new Date(l.fecha_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        {' · '}Ordem: #{l.ordem}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Toggle ativo */}
                      <button id={`toggle-lote-${l.id}`}
                        disabled={salvando === l.id}
                        onClick={() => handleToggleLote(l.id, l.ativo)}
                        title={l.ativo ? 'Desativar lote' : 'Ativar lote'}
                        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${l.ativo ? 'bg-brand-purple' : 'bg-brand-lilac-mid'}`}>
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${l.ativo ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                      {/* Editar */}
                      <button id={`editar-lote-${l.id}`}
                        onClick={() => abrirEditarLote(l)}
                        className="text-[12px] text-brand-purple hover:underline font-medium px-2 py-1">
                        Editar
                      </button>
                      {/* Deletar */}
                      <button id={`deletar-lote-${l.id}`}
                        disabled={salvando === l.id}
                        onClick={() => handleDeletarLote(l)}
                        className="text-[12px] text-red-400 hover:text-red-600 font-medium px-1">
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {lotes.length === 0 && (
                <div className="p-8 text-center text-brand-muted">
                  Nenhum lote cadastrado. Clique em "+ Novo lote" para começar.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ABA CUPONS ── */}
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

      {/* ── Modal de criar/editar lote ── */}
      {loteForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setLoteForm(null); setLoteErro(''); }} />
          <div className="relative bg-white rounded-2xl w-full max-w-[520px] p-6 shadow-2xl animate-fade-up">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-extrabold italic uppercase text-[22px] text-brand-ink">
                {loteForm.id ? 'Editar lote' : 'Novo lote'}
              </h3>
              <button onClick={() => { setLoteForm(null); setLoteErro(''); }}
                className="text-brand-muted text-[24px] leading-none">×</button>
            </div>

            <form onSubmit={handleSalvarLote} className="grid gap-4 md:grid-cols-2">
              {/* Prova (só para criação) */}
              {!loteForm.id && (
                <div className="md:col-span-2">
                  <label className="label">Prova *</label>
                  <select className="input" value={loteForm.race_id}
                    onChange={e => setLoteForm({ ...loteForm, race_id: e.target.value })}>
                    <option value="">Selecione...</option>
                    {races.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </div>
              )}

              {loteForm.id && (
                <div className="md:col-span-2 bg-brand-lilac rounded-xl px-4 py-2 text-[12px] text-brand-purple-dark">
                  Editando lote da prova: <strong>{lotes.find(l => l.id === loteForm.id)?.prova}</strong>
                </div>
              )}

              <div className="md:col-span-2">
                <label className="label">Nome do lote *</label>
                <input id="input-lote-nome" className="input"
                  value={loteForm.nome}
                  onChange={e => setLoteForm({ ...loteForm, nome: e.target.value })}
                  placeholder="Ex: Lote 1 · Antecipado" />
              </div>

              <div>
                <label className="label">Preço (R$) *</label>
                <input id="input-lote-preco" className="input"
                  value={loteForm.preco_reais}
                  onChange={e => setLoteForm({ ...loteForm, preco_reais: e.target.value })}
                  placeholder="79,00" />
              </div>

              <div>
                <label className="label">Ordem de exibição</label>
                <input type="number" className="input" min={1}
                  value={loteForm.ordem}
                  onChange={e => setLoteForm({ ...loteForm, ordem: e.target.value })}
                  placeholder="1" />
              </div>

              <div>
                <label className="label">Abre em *</label>
                <input type="datetime-local" className="input"
                  value={loteForm.abre_em}
                  onChange={e => setLoteForm({ ...loteForm, abre_em: e.target.value })} />
              </div>

              <div>
                <label className="label">Fecha em *</label>
                <input type="datetime-local" className="input"
                  value={loteForm.fecha_em}
                  onChange={e => setLoteForm({ ...loteForm, fecha_em: e.target.value })} />
              </div>

              {loteErro && (
                <div className="md:col-span-2 bg-red-50 border border-red-300 rounded-xl px-4 py-3 text-red-600 text-[13px]">
                  {loteErro}
                </div>
              )}

              <div className="md:col-span-2 flex gap-3">
                <button type="button" onClick={() => { setLoteForm(null); setLoteErro(''); }}
                  className="flex-1 py-3 rounded-xl border-2 border-brand-lilac-mid text-brand-muted font-semibold text-[14px] hover:border-brand-purple hover:text-brand-purple transition-colors">
                  Cancelar
                </button>
                <button id="btn-salvar-lote" type="submit" disabled={salvando === 'form'}
                  className="flex-1 btn-primary py-3 text-[14px]">
                  {salvando === 'form' ? 'Salvando...' : loteForm.id ? '✓ Salvar alterações' : '+ Criar lote'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
