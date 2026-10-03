// src/pages/admin/Camisetas.tsx — Controle das camisetas e relatórios para o fornecedor

import { useEffect, useMemo, useState } from 'react';
import {
  getPedidosCamisetas, registrarPedidoCamisetas, excluirPedidoCamisetas,
  getReservaCamisetas, salvarReservaCamiseta,
} from '../../services/adminService';
import type { InscritoRow, PedidoCamisetaRow } from '../../services/adminService';
import {
  MODELOS, MODELO_LABEL, STATUS_LABEL, chaveReserva, comCamiseta, modeloDe, montarPedido,
  somarPedidos, montarSituacao, montarComplemento, itensDe,
  textoPedido, csvPedido, csvNominal, htmlPedido, ordenarNominal,
} from '../../lib/pedidoCamisetas';
import type { ModeloKey, Reserva } from '../../lib/pedidoCamisetas';

interface Props { eventoId: string; inscritos: InscritoRow[]; onRecarregar: () => void; loading: boolean; }

const STATUS_OPCOES = ['confirmado', 'em_analise', 'pendente'] as const;
const STATUS_COR: Record<string, string> = {
  confirmado: 'bg-green-100 text-green-800',
  em_analise: 'bg-amber-100 text-amber-800',
  pendente:   'bg-orange-50 text-orange-700',
};

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

function baixar(conteudo: string, nome: string) {
  const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Camisetas({ eventoId, inscritos, onRecarregar, loading }: Props) {
  const [statuses, setStatuses] = useState<Set<string>>(new Set(['confirmado']));
  const [reserva, setReserva]   = useState<Reserva>({});
  const [pedidos, setPedidos]   = useState<PedidoCamisetaRow[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [fornecedor, setFornecedor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro]         = useState('');
  const [obs, setObs]           = useState('');
  const [copiado, setCopiado]   = useState(false);
  const [fModelo, setFModelo]   = useState<'todos' | ModeloKey>('todos');
  const [fTamanho, setFTamanho] = useState('todos');
  const [busca, setBusca]       = useState('');

  useEffect(() => {
    let ativo = true;
    Promise.all([getPedidosCamisetas(eventoId), getReservaCamisetas(eventoId)]).then(([p, r]) => {
      if (!ativo) return;
      setPedidos(p); setReserva(r); setCarregado(true);
    });
    return () => { ativo = false; };
  }, [eventoId]);

  const base   = useMemo(() => comCamiseta(inscritos), [inscritos]);
  // pedido = tudo que é necessário hoje (inscritos + reserva)
  const pedido = useMemo(() => montarPedido(inscritos, statuses, reserva), [inscritos, statuses, reserva]);

  // Comparação com o que já foi enviado ao fornecedor
  const jaPedido    = useMemo(() => somarPedidos(pedidos), [pedidos]);
  const situacao    = useMemo(() => montarSituacao(pedido, jaPedido), [pedido, jaPedido]);
  const complemento = useMemo(() => montarComplemento(situacao), [situacao]);
  const temPedidos  = pedidos.length > 0;
  const totalJaPedido = pedidos.reduce((acc, p) => acc + p.total, 0);
  const sobra = situacao.reduce((acc, s) =>
    acc + MODELOS.reduce((a, m) => a + Math.max(0, -s.porModelo[m].diferenca), 0), 0);

  // O relatório sai com o pedido cheio no 1º envio e só com o complemento nos seguintes
  const relatorio = temPedidos ? complemento : pedido;
  const titulo    = temPedidos ? `Pedido complementar de camisetas nº ${pedidos.length + 1}` : 'Pedido de camisetas';

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
    setReserva(prev => ({ ...prev, [chaveReserva(modelo, tamanho)]: n }));
  };

  // Grava a reserva no banco ao sair do campo
  const persistirReserva = async (modelo: ModeloKey, tamanho: string) => {
    const res = await salvarReservaCamiseta(eventoId, modelo, tamanho, reserva[chaveReserva(modelo, tamanho)] ?? 0);
    setErro(res.ok ? '' : `Não foi possível salvar a reserva: ${res.erro}`);
  };

  const handleRegistrar = async () => {
    if (relatorio.total === 0) return;
    const msg = `Registrar ${temPedidos ? 'pedido complementar' : 'pedido'} de ${relatorio.total} peças como enviado ao fornecedor?`;
    if (!confirm(msg)) return;
    setSalvando(true);
    const res = await registrarPedidoCamisetas(eventoId, itensDe(relatorio), fornecedor, obs);
    if (res.ok) { setErro(''); setObs(''); setPedidos(await getPedidosCamisetas(eventoId)); }
    else setErro(`Não foi possível registrar o pedido: ${res.erro}`);
    setSalvando(false);
  };

  const handleExcluirPedido = async (p: PedidoCamisetaRow, numero: number) => {
    if (!confirm(`Excluir o registro do pedido nº ${numero} (${p.total} peças)? As peças voltam a aparecer como "a pedir".`)) return;
    const res = await excluirPedidoCamisetas(p.id);
    if (res.ok) { setErro(''); setPedidos(await getPedidosCamisetas(eventoId)); }
    else setErro(`Não foi possível excluir o pedido: ${res.erro}`);
  };

  const handleCopiar = async () => {
    const texto = textoPedido(relatorio, titulo) +(obs.trim() ? `\n\nObs.: ${obs.trim()}` : '');
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const handleImprimir = () => {
    const w = window.open('', '_blank');
    if (!w) { alert('O navegador bloqueou a janela de impressão. Libere pop-ups para este site.'); return; }
    w.document.write(htmlPedido(relatorio, obs, titulo));
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

      {erro && (
        <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-4 text-[13px] text-red-800">{erro}</div>
      )}

      {/* Resumo */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <div className="card p-5">
          <div className="text-[11px] text-brand-muted uppercase tracking-[0.12em]">Necessário</div>
          <div className="font-display font-extrabold text-[28px] text-brand-ink mt-1">{pedido.total}</div>
          <div className="text-[12px] text-brand-muted">
            {MODELOS.map(m => `${totalModelo(m)} ${MODELO_LABEL[m]}`).join(' · ')}
          </div>
        </div>
        <div className="card p-5">
          <div className="text-[11px] text-brand-muted uppercase tracking-[0.12em]">Já pedido</div>
          <div className="font-display font-extrabold text-[28px] text-green-600 mt-1">{totalJaPedido}</div>
          <div className="text-[12px] text-brand-muted">
            {temPedidos ? `${pedidos.length} ${pedidos.length === 1 ? 'envio registrado' : 'envios registrados'}` : 'Nenhum envio registrado'}
          </div>
        </div>
        <div className="card p-5 border-brand-purple-mid">
          <div className="text-[11px] text-brand-muted uppercase tracking-[0.12em]">A pedir agora</div>
          <div className="font-display font-extrabold text-[28px] text-brand-purple mt-1">{relatorio.total}</div>
          {sobra > 0 && <div className="text-[12px] text-amber-700">{sobra} já pedidas a mais que o necessário</div>}
        </div>
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
          <h3 className="font-semibold text-brand-ink">Necessário — modelo × tamanho</h3>
          <div className="text-[12px] text-brand-muted">
            Reserva = peças extras além dos inscritos (trocas, staff, cortesias). É salva no sistema ao sair do campo.
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
                          onChange={e => setReservaCelula(m, l.tamanho, e.target.value)}
                          onBlur={() => persistirReserva(m, l.tamanho)} />
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

      {/* Situação: necessário × já pedido */}
      {temPedidos && (
        <div className="card overflow-hidden">
          <div className="p-5 pb-3">
            <h3 className="font-semibold text-brand-ink">Situação do pedido — necessário × já pedido</h3>
            <div className="text-[12px] text-brand-muted">
              "Falta" é o que entra no próximo pedido complementar. "Sobra" são peças já pedidas além do necessário (ex.: cancelamentos).
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="bg-brand-lilac text-brand-purple-dark text-[12px] uppercase tracking-wider">
                  <th className="px-4 py-2.5 text-left">Tamanho</th>
                  {MODELOS.map(m => <th key={m} className="px-3 py-2.5 text-center" colSpan={3}>{MODELO_LABEL[m]}</th>)}
                </tr>
                <tr className="text-[11px] text-brand-muted border-b border-brand-lilac-mid">
                  <th />
                  {MODELOS.map(m => (
                    <th key={m} colSpan={3} className="px-3 py-1 font-normal">
                      <div className="grid grid-cols-3"><span>necessário</span><span>já pedido</span><span>diferença</span></div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {situacao.map(s => (
                  <tr key={s.tamanho} className="border-b border-brand-lilac-mid last:border-0">
                    <td className="px-4 py-2 font-display font-bold text-[16px]">{s.tamanho}</td>
                    {MODELOS.map(m => {
                      const c = s.porModelo[m];
                      return (
                        <td key={m} colSpan={3} className="px-3 py-2">
                          <div className="grid grid-cols-3 text-center items-center">
                            <span>{c.necessario || '–'}</span>
                            <span className="text-green-700">{c.pedido || '–'}</span>
                            <span className={`font-bold ${c.diferenca > 0 ? 'text-brand-purple' : c.diferenca < 0 ? 'text-amber-700' : 'text-brand-muted'}`}>
                              {c.diferenca > 0 ? `falta ${c.diferenca}` : c.diferenca < 0 ? `sobra ${-c.diferenca}` : 'ok'}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Relatórios */}
      <div className="card p-5 space-y-3">
        <h3 className="font-semibold text-brand-ink">
          {temPedidos ? `Relatório para o fornecedor — pedido complementar nº ${pedidos.length + 1}` : 'Relatório para o fornecedor'}
        </h3>
        {temPedidos && relatorio.total === 0 && (
          <div className="text-[13px] text-green-700 font-semibold">✓ Tudo que é necessário já foi pedido. Não há complemento a enviar.</div>
        )}
        <div>
          <label className="label" htmlFor="input-camisetas-fornecedor">Fornecedor (opcional — fica no histórico)</label>
          <input id="input-camisetas-fornecedor" className="input" value={fornecedor}
            onChange={e => setFornecedor(e.target.value)} placeholder="Nome do fornecedor" />
        </div>
        <div>
          <label className="label" htmlFor="input-camisetas-obs">Observações (opcional — saem no texto e na impressão)</label>
          <textarea id="input-camisetas-obs" className="input" rows={2} value={obs}
            onChange={e => setObs(e.target.value)} placeholder="Ex: tecido dry-fit, entrega até 08/10" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button id="btn-camisetas-copiar" onClick={handleCopiar} disabled={relatorio.total === 0}
            className="btn-primary text-sm px-4 py-2.5">
            {copiado ? '✓ Copiado' : '📋 Copiar texto (WhatsApp)'}
          </button>
          <button id="btn-camisetas-imprimir" onClick={handleImprimir} disabled={relatorio.total === 0}
            className="btn-outline text-sm px-4 py-2.5">
            🖨️ Imprimir / PDF
          </button>
          <button id="btn-camisetas-csv" disabled={relatorio.total === 0}
            onClick={() => baixar(csvPedido(relatorio),`inorun-pedido-camisetas-${dataArq}.csv`)}
            className="btn-outline text-sm px-4 py-2.5">
            ⬇ Planilha do pedido
          </button>
        </div>
        <pre className="bg-brand-bg border border-brand-lilac-mid rounded-xl p-4 text-[13px] whitespace-pre-wrap font-sans">
          {textoPedido(relatorio, titulo)}{obs.trim() ? `\n\nObs.: ${obs.trim()}` : ''}
        </pre>
        <div className="pt-3 border-t border-brand-lilac-mid flex items-center gap-3 flex-wrap">
          <button id="btn-camisetas-registrar" onClick={handleRegistrar}
            disabled={relatorio.total === 0 || salvando || !carregado}
            className="btn-accent text-sm px-4 py-2.5">
            {salvando ? 'Registrando...' : `✓ Registrar como enviado (${relatorio.total} peças)`}
          </button>
          <span className="text-[12px] text-brand-muted">
            Clique depois de mandar o pedido ao fornecedor. A partir daí a tela mostra só o que faltar.
          </span>
        </div>
      </div>

      {/* Histórico de envios */}
      {temPedidos && (
        <div className="card overflow-hidden">
          <div className="p-5 pb-3">
            <h3 className="font-semibold text-brand-ink">Pedidos enviados ao fornecedor ({pedidos.length})</h3>
          </div>
          <div className="divide-y divide-brand-lilac-mid">
            {pedidos.map((p, idx) => (
              <div key={p.id} className="px-5 py-3 flex items-start justify-between gap-4">
                <div className="text-[13px]">
                  <div className="font-semibold text-brand-ink">
                    Pedido nº {idx + 1} · {p.total} peças · {dataHora(p.created_at)}{p.fornecedor ? ` · ${p.fornecedor}` : ''}
                  </div>
                  {MODELOS.map(m => {
                    const itens = p.itens.filter(it => it.modelo === m);
                    if (itens.length === 0) return null;
                    return (
                      <div key={m} className="text-brand-muted">
                        {MODELO_LABEL[m]}: {itens.map(it => `${it.tamanho} ${it.quantidade}`).join(' · ')}
                      </div>
                    );
                  })}
                  {p.observacao && <div className="text-brand-muted italic">Obs.: {p.observacao}</div>}
                </div>
                <button id={`btn-camisetas-excluir-${p.id}`} onClick={() => handleExcluirPedido(p, idx + 1)}
                  className="text-[12px] text-brand-muted hover:text-red-500 transition-colors whitespace-nowrap">
                  Excluir registro
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
