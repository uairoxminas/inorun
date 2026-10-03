// src/pages/admin/Camisetas.tsx — Controle das camisetas e relatórios para o fornecedor

import { useMemo, useState } from 'react';
import type { InscritoRow } from '../../services/adminService';
import {
  MODELOS, MODELO_LABEL, STATUS_LABEL, chaveReserva, comCamiseta, modeloDe, montarPedido,
  textoPedido, csvPedido, csvNominal, htmlPedido, ordenarNominal,
} from '../../lib/pedidoCamisetas';
import type { ModeloKey, Reserva } from '../../lib/pedidoCamisetas';

interface Props { inscritos: InscritoRow[]; onRecarregar: () => void; loading: boolean; }

const STATUS_OPCOES = ['confirmado', 'em_analise', 'pendente'] as const;
const STATUS_COR: Record<string, string> = {
  confirmado: 'bg-green-100 text-green-800',
  em_analise: 'bg-amber-100 text-amber-800',
  pendente:   'bg-orange-50 text-orange-700',
};
const RESERVA_KEY = 'inorun_camisetas_reserva';

function lerReserva(): Reserva {
  try { return JSON.parse(localStorage.getItem(RESERVA_KEY) ?? '{}') as Reserva; } catch { return {}; }
}

function baixar(conteudo: string, nome: string) {
  const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Camisetas({ inscritos, onRecarregar, loading }: Props) {
  const [statuses, setStatuses] = useState<Set<string>>(new Set(['confirmado']));
  const [reserva, setReserva]   = useState<Reserva>(lerReserva);
  const [obs, setObs]           = useState('');
  const [copiado, setCopiado]   = useState(false);
  const [fModelo, setFModelo]   = useState<'todos' | ModeloKey>('todos');
  const [fTamanho, setFTamanho] = useState('todos');
  const [busca, setBusca]       = useState('');

  const base   = useMemo(() => comCamiseta(inscritos), [inscritos]);
  const pedido = useMemo(() => montarPedido(inscritos, statuses, reserva), [inscritos, statuses, reserva]);

  const porStatus = (s: string) => base.filter(i => i.status === s).length;
  const semCamiseta = inscritos.filter(i => i.status !== 'cancelado' && !i.camiseta).length;

  // Mesmo CPF com mais de uma camiseta no recorte atual — vale conferir antes de pedir
  const repetidos = useMemo(() => {
    const porCpf = new Map<string, InscritoRow[]>();
    base.filter(i => statuses.has(i.status) && i.cpf).forEach(i => {
      porCpf.set(i.cpf, [...(porCpf.get(i.cpf) ?? []), i]);
    });
    return [...porCpf.values()].filter(l => l.length > 1);
  }, [base, statuses]);

  const nominal = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return ordenarNominal(base.filter(i =>
      statuses.has(i.status) &&
      (fModelo === 'todos' || modeloDe(i) === fModelo) &&
      (fTamanho === 'todos' || i.camiseta === fTamanho) &&
      (!q || i.nome.toLowerCase().includes(q) || String(i.bib_number ?? '').includes(q))
    ));
  }, [base, statuses, fModelo, fTamanho, busca]);

  const toggleStatus = (s: string) => {
    if (s === 'confirmado') return; // confirmadas sempre entram
    setStatuses(prev => {
      const novo = new Set(prev);
      if (novo.has(s)) novo.delete(s); else novo.add(s);
      return novo;
    });
  };

  const setReservaCelula = (modelo: ModeloKey, tamanho: string, valor: string) => {
    const n = Math.max(0, Math.floor(Number(valor) || 0));
    setReserva(prev => {
      const novo = { ...prev, [chaveReserva(modelo, tamanho)]: n };
      try { localStorage.setItem(RESERVA_KEY, JSON.stringify(novo)); } catch { /* sem storage: vale só nesta sessão */ }
      return novo;
    });
  };

  const handleCopiar = async () => {
    const texto = textoPedido(pedido) + (obs.trim() ? `\n\nObs.: ${obs.trim()}` : '');
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const handleImprimir = () => {
    const w = window.open('', '_blank');
    if (!w) { alert('O navegador bloqueou a janela de impressão. Libere pop-ups para este site.'); return; }
    w.document.write(htmlPedido(pedido, obs));
    w.document.close();
    w.focus();
    w.print();
  };

  const dataArq = new Date().toISOString().slice(0, 10);
  const totalModelo = (m: ModeloKey) => pedido.inscritos[m] + pedido.reserva[m];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-display font-extrabold italic uppercase text-[32px] text-brand-ink leading-none">
          Controle de Camisetas
        </h2>
        <button id="btn-camisetas-atualizar" onClick={onRecarregar} disabled={loading}
          className="btn-outline text-sm px-4 py-2">
          {loading ? 'Atualizando...' : '↻ Atualizar'}
        </button>
      </div>

      {/* Resumo */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <div className="card p-5 border-brand-purple-mid">
          <div className="text-[11px] text-brand-muted uppercase tracking-[0.12em]">Total do pedido</div>
          <div className="font-display font-extrabold text-[28px] text-brand-purple mt-1">{pedido.total}</div>
        </div>
        {MODELOS.map(m => (
          <div key={m} className="card p-5">
            <div className="text-[11px] text-brand-muted uppercase tracking-[0.12em]">{MODELO_LABEL[m]}</div>
            <div className="font-display font-extrabold text-[28px] text-brand-ink mt-1">{totalModelo(m)}</div>
            {pedido.reserva[m] > 0 && (
              <div className="text-[12px] text-brand-muted">{pedido.inscritos[m]} inscritos + {pedido.reserva[m]} reserva</div>
            )}
          </div>
        ))}
        <div className="card p-5">
          <div className="text-[11px] text-brand-muted uppercase tracking-[0.12em]">Sem camiseta</div>
          <div className="font-display font-extrabold text-[28px] text-brand-muted mt-1">{semCamiseta}</div>
          <div className="text-[12px] text-brand-muted">Kids e inscrições após 05/10</div>
        </div>
      </div>

      {/* Quem entra no pedido */}
      <div className="card p-5">
        <div className="label">Inscrições que entram no pedido</div>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPCOES.map(s => (
            <button key={s} id={`filtro-camisetas-${s}`} onClick={() => toggleStatus(s)}
              className={`px-4 py-2 rounded-xl border-2 text-[13px] font-semibold transition-all
                ${statuses.has(s) ? 'bg-brand-purple text-white border-brand-purple' : 'bg-white text-brand-ink border-brand-lilac-mid hover:border-brand-purple'}
                ${s === 'confirmado' ? 'cursor-default' : ''}`}>
              {statuses.has(s) ? '✓ ' : ''}{STATUS_LABEL[s]} ({porStatus(s)})
            </button>
          ))}
        </div>
        <div className="text-[12px] text-brand-muted mt-2">
          Confirmadas sempre entram. Marque as outras para incluir quem ainda não teve o pagamento confirmado.
        </div>
      </div>

      {repetidos.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-[13px] text-amber-900">
          <strong>⚠️ Conferir antes de pedir:</strong> {repetidos.length === 1 ? 'há 1 atleta' : `há ${repetidos.length} atletas`} com mais de uma camiseta neste recorte.
          <ul className="mt-1 list-disc pl-5">
            {repetidos.map(l => (
              <li key={l[0].cpf}>
                {l[0].nome}: {l.map(i => `${MODELO_LABEL[modeloDe(i)]} ${i.camiseta} (${i.prova}, ${STATUS_LABEL[i.status] ?? i.status})`).join(' · ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quadro do pedido */}
      <div className="card overflow-hidden">
        <div className="p-5 pb-3">
          <h3 className="font-semibold text-brand-ink">Quadro do pedido — modelo × tamanho</h3>
          <div className="text-[12px] text-brand-muted">
            Reserva = peças extras além dos inscritos (trocas, staff, cortesias). Fica salva neste navegador.
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="bg-brand-lilac text-brand-purple-dark text-[12px] uppercase tracking-wider">
                <th className="px-4 py-2.5 text-left">Tamanho</th>
                {MODELOS.map(m => (
                  <th key={m} className="px-3 py-2.5 text-center" colSpan={2}>{MODELO_LABEL[m]}</th>
                ))}
                <th className="px-4 py-2.5 text-center">Total</th>
              </tr>
              <tr className="text-[11px] text-brand-muted border-b border-brand-lilac-mid">
                <th />
                {MODELOS.map(m => (
                  <th key={m} colSpan={2} className="px-3 py-1 font-normal">
                    <div className="grid grid-cols-2"><span>inscritos</span><span>reserva</span></div>
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {pedido.linhas.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-brand-muted">Nenhuma camiseta neste recorte</td></tr>
              )}
              {pedido.linhas.map(l => (
                <tr key={l.tamanho} className="border-b border-brand-lilac-mid last:border-0">
                  <td className="px-4 py-2 font-display font-bold text-[16px]">{l.tamanho}</td>
                  {MODELOS.map(m => (
                    <td key={m} colSpan={2} className="px-3 py-2">
                      <div className="grid grid-cols-2 items-center gap-2">
                        <span className="text-center font-semibold">{l.inscritos[m] || '–'}</span>
                        <input id={`reserva-${m}-${l.tamanho}`} type="number" min={0} inputMode="numeric"
                          aria-label={`Reserva ${MODELO_LABEL[m]} ${l.tamanho}`}
                          className="w-16 mx-auto border border-brand-lilac-mid rounded-lg px-2 py-1 text-center text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-purple"
                          value={l.reserva[m] || ''} placeholder="0"
                          onChange={e => setReservaCelula(m, l.tamanho, e.target.value)} />
                      </div>
                    </td>
                  ))}
                  <td className="px-4 py-2 text-center font-display font-extrabold text-[16px] text-brand-purple">{l.total}</td>
                </tr>
              ))}
            </tbody>
            {pedido.linhas.length > 0 && (
              <tfoot>
                <tr className="bg-brand-lilac font-bold">
                  <td className="px-4 py-2.5">Total</td>
                  {MODELOS.map(m => (
                    <td key={m} colSpan={2} className="px-3 py-2.5">
                      <div className="grid grid-cols-2 text-center">
                        <span>{pedido.inscritos[m]}</span><span>{pedido.reserva[m] || '–'}</span>
                      </div>
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-center text-brand-purple">{pedido.total}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Relatórios */}
      <div className="card p-5 space-y-3">
        <h3 className="font-semibold text-brand-ink">Relatório para o fornecedor</h3>
        <div>
          <label className="label" htmlFor="input-camisetas-obs">Observações (opcional — saem no texto e na impressão)</label>
          <textarea id="input-camisetas-obs" className="input" rows={2} value={obs}
            onChange={e => setObs(e.target.value)} placeholder="Ex: tecido dry-fit, entrega até 08/10" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button id="btn-camisetas-copiar" onClick={handleCopiar} disabled={pedido.total === 0}
            className="btn-primary text-sm px-4 py-2.5">
            {copiado ? '✓ Copiado' : '📋 Copiar texto (WhatsApp)'}
          </button>
          <button id="btn-camisetas-imprimir" onClick={handleImprimir} disabled={pedido.total === 0}
            className="btn-outline text-sm px-4 py-2.5">
            🖨️ Imprimir / PDF
          </button>
          <button id="btn-camisetas-csv" disabled={pedido.total === 0}
            onClick={() => baixar(csvPedido(pedido), `inorun-pedido-camisetas-${dataArq}.csv`)}
            className="btn-outline text-sm px-4 py-2.5">
            ⬇ Planilha do pedido
          </button>
        </div>
        <pre className="bg-brand-bg border border-brand-lilac-mid rounded-xl p-4 text-[13px] whitespace-pre-wrap font-sans">
          {textoPedido(pedido)}{obs.trim() ? `\n\nObs.: ${obs.trim()}` : ''}
        </pre>
      </div>

      {/* Lista nominal */}
      <div className="card overflow-hidden">
        <div className="p-5 pb-3 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-semibold text-brand-ink">Lista nominal ({nominal.length})</h3>
              <div className="text-[12px] text-brand-muted">Uso interno, para separar os kits. Não vai ao fornecedor.</div>
            </div>
            <button id="btn-camisetas-nominal" disabled={nominal.length === 0}
              onClick={() => baixar(csvNominal(nominal), `inorun-camisetas-nominal-${dataArq}.csv`)}
              className="btn-outline text-sm px-4 py-2">
              ⬇ Baixar lista
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <input id="input-camisetas-busca" className="input" placeholder="Buscar por nome ou nº de peito"
              value={busca} onChange={e => setBusca(e.target.value)} />
            <select id="select-camisetas-modelo" className="input" value={fModelo}
              onChange={e => setFModelo(e.target.value as 'todos' | ModeloKey)}>
              <option value="todos">Todos os modelos</option>
              {MODELOS.map(m => <option key={m} value={m}>{MODELO_LABEL[m]}</option>)}
            </select>
            <select id="select-camisetas-tamanho" className="input" value={fTamanho}
              onChange={e => setFTamanho(e.target.value)}>
              <option value="todos">Todos os tamanhos</option>
              {pedido.linhas.map(l => <option key={l.tamanho} value={l.tamanho}>{l.tamanho}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-brand-lilac text-brand-purple-dark text-[12px] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2.5 text-left">Modelo</th>
                <th className="px-3 py-2.5 text-center">Tam.</th>
                <th className="px-3 py-2.5 text-center">Nº</th>
                <th className="px-3 py-2.5 text-left">Nome</th>
                <th className="px-3 py-2.5 text-left">Prova</th>
                <th className="px-4 py-2.5 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {nominal.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-brand-muted">Ninguém encontrado com esses filtros</td></tr>
              )}
              {nominal.map(i => (
                <tr key={i.registration_id} className="border-b border-brand-lilac-mid last:border-0">
                  <td className="px-4 py-2">{MODELO_LABEL[modeloDe(i)]}</td>
                  <td className="px-3 py-2 text-center font-bold">{i.camiseta}</td>
                  <td className="px-3 py-2 text-center text-brand-muted">{i.bib_number ?? '–'}</td>
                  <td className="px-3 py-2">{i.nome}</td>
                  <td className="px-3 py-2 text-brand-muted">{i.prova}</td>
                  <td className="px-4 py-2">
                    <span className={`text-[12px] px-2.5 py-0.5 rounded-full font-medium ${STATUS_COR[i.status] ?? ''}`}>
                      {STATUS_LABEL[i.status] ?? i.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
