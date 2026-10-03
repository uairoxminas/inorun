// src/lib/pedidoCamisetas.ts
// Módulo puro: consolida as camisetas dos inscritos em um pedido para o fornecedor
// (modelo × tamanho), com reserva técnica opcional, e gera os relatórios em texto/CSV/HTML.

import { CAMISETAS_TODOS } from './camisetas';
import type { InscritoRow } from '../services/adminService';

export type ModeloKey = 'unissex' | 'babylook';
export const MODELOS: ModeloKey[] = ['unissex', 'babylook'];
export const MODELO_LABEL: Record<ModeloKey, string> = { unissex: 'Unissex', babylook: 'Baby Look' };

export const STATUS_LABEL: Record<string, string> = {
  confirmado: 'Confirmado', em_analise: 'Em análise', pendente: 'Pendente',
};

/** Reserva técnica (peças extras) por célula. Chave: `${modelo}:${tamanho}`. */
export type Reserva = Record<string, number>;
export const chaveReserva = (modelo: ModeloKey, tamanho: string) => `${modelo}:${tamanho}`;

export interface LinhaPedido {
  tamanho: string;
  inscritos: Record<ModeloKey, number>;
  reserva:   Record<ModeloKey, number>;
  total: number; // inscritos + reserva, somando os dois modelos
}

export interface Pedido {
  linhas: LinhaPedido[];
  inscritos: Record<ModeloKey, number>;
  reserva:   Record<ModeloKey, number>;
  total: number;
}

export const modeloDe = (i: InscritoRow): ModeloKey =>
  i.camiseta_modelo === 'babylook' ? 'babylook' : 'unissex';

/** Inscrições que geram camiseta: não canceladas e com tamanho gravado (Kids e pós-05/10 ficam de fora). */
export function comCamiseta(inscritos: InscritoRow[]): InscritoRow[] {
  return inscritos.filter(i => i.status !== 'cancelado' && !!i.camiseta);
}

const ordemTamanho = (t: string) => {
  const idx = CAMISETAS_TODOS.indexOf(t);
  return idx === -1 ? 999 : idx;
};

export function montarPedido(inscritos: InscritoRow[], statuses: Set<string>, reserva: Reserva): Pedido {
  const base = comCamiseta(inscritos).filter(i => statuses.has(i.status));
  const tamanhos = new Set<string>(base.map(i => i.camiseta));
  // Tamanho só com reserva (sem inscrito) também entra no pedido
  Object.entries(reserva).forEach(([k, v]) => { if (v > 0) tamanhos.add(k.split(':')[1]); });

  const linhas: LinhaPedido[] = [...tamanhos]
    .sort((a, b) => ordemTamanho(a) - ordemTamanho(b))
    .map(tamanho => {
      const insc = { unissex: 0, babylook: 0 };
      base.filter(i => i.camiseta === tamanho).forEach(i => { insc[modeloDe(i)]++; });
      const res = {
        unissex:  reserva[chaveReserva('unissex', tamanho)]  ?? 0,
        babylook: reserva[chaveReserva('babylook', tamanho)] ?? 0,
      };
      return { tamanho, inscritos: insc, reserva: res, total: insc.unissex + insc.babylook + res.unissex + res.babylook };
    });

  const soma = (campo: 'inscritos' | 'reserva', m: ModeloKey) => linhas.reduce((acc, l) => acc + l[campo][m], 0);
  return {
    linhas,
    inscritos: { unissex: soma('inscritos', 'unissex'), babylook: soma('inscritos', 'babylook') },
    reserva:   { unissex: soma('reserva', 'unissex'),   babylook: soma('reserva', 'babylook') },
    total: linhas.reduce((acc, l) => acc + l.total, 0),
  };
}

// ─── Pedidos já enviados ao fornecedor ──────────────────────────────────────

export interface ItemPedido { modelo: ModeloKey; tamanho: string; quantidade: number; }

/** Peças por célula (`${modelo}:${tamanho}`), somando todos os envios registrados. */
export type PorCelula = Record<string, number>;

export function somarPedidos(pedidos: { itens: ItemPedido[] }[]): PorCelula {
  const soma: PorCelula = {};
  pedidos.forEach(p => p.itens.forEach(it => {
    const k = chaveReserva(it.modelo, it.tamanho);
    soma[k] = (soma[k] ?? 0) + it.quantidade;
  }));
  return soma;
}

export interface CelulaSituacao { necessario: number; pedido: number; diferenca: number; } // diferenca > 0 = falta pedir; < 0 = sobra
export interface LinhaSituacao { tamanho: string; porModelo: Record<ModeloKey, CelulaSituacao>; }

/** Compara o necessário (inscritos + reserva) com o que já foi enviado ao fornecedor. */
export function montarSituacao(necessario: Pedido, jaPedido: PorCelula): LinhaSituacao[] {
  const tamanhos = new Set<string>(necessario.linhas.map(l => l.tamanho));
  Object.keys(jaPedido).forEach(k => tamanhos.add(k.split(':')[1]));
  return [...tamanhos].sort((a, b) => ordemTamanho(a) - ordemTamanho(b)).map(tamanho => {
    const linha = necessario.linhas.find(l => l.tamanho === tamanho);
    const cel = (m: ModeloKey): CelulaSituacao => {
      const nec = linha ? linha.inscritos[m] + linha.reserva[m] : 0;
      const ped = jaPedido[chaveReserva(m, tamanho)] ?? 0;
      return { necessario: nec, pedido: ped, diferenca: nec - ped };
    };
    return { tamanho, porModelo: { unissex: cel('unissex'), babylook: cel('babylook') } };
  });
}

/** Só o que falta pedir, no formato de Pedido (para reaproveitar os relatórios). */
export function montarComplemento(situacao: LinhaSituacao[]): Pedido {
  const linhas: LinhaPedido[] = situacao.map(s => {
    const insc = {
      unissex:  Math.max(0, s.porModelo.unissex.diferenca),
      babylook: Math.max(0, s.porModelo.babylook.diferenca),
    };
    return { tamanho: s.tamanho, inscritos: insc, reserva: { unissex: 0, babylook: 0 }, total: insc.unissex + insc.babylook };
  }).filter(l => l.total > 0);
  const soma = (m: ModeloKey) => linhas.reduce((acc, l) => acc + l.inscritos[m], 0);
  return {
    linhas,
    inscritos: { unissex: soma('unissex'), babylook: soma('babylook') },
    reserva:   { unissex: 0, babylook: 0 },
    total: linhas.reduce((acc, l) => acc + l.total, 0),
  };
}

export function itensDe(p: Pedido): ItemPedido[] {
  return MODELOS.flatMap(m => p.linhas
    .map(l => ({ modelo: m, tamanho: l.tamanho, quantidade: l.inscritos[m] + l.reserva[m] }))
    .filter(it => it.quantidade > 0));
}

// ─── Relatórios ─────────────────────────────────────────────────────────────

const qtd = (l: LinhaPedido, m: ModeloKey) => l.inscritos[m] + l.reserva[m];
const totalModelo = (p: Pedido, m: ModeloKey) => p.inscritos[m] + p.reserva[m];
const hoje = () => new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

/** Texto pronto para WhatsApp/e-mail (asteriscos = negrito no WhatsApp). */
export function textoPedido(p: Pedido, titulo = 'Pedido de camisetas'): string {
  const bloco = (m: ModeloKey) => [
    `*${MODELO_LABEL[m]}* — ${totalModelo(p, m)} peças`,
    ...p.linhas.filter(l => qtd(l, m) > 0).map(l => `• ${l.tamanho}: ${qtd(l, m)}`),
  ].join('\n');
  return [
    `*INO RUN 2026 — ${titulo}*`,
    `Data: ${hoje()}`,
    '',
    // modelo sem peça (comum em pedido complementar) não aparece
    ...MODELOS.filter(m => totalModelo(p, m) > 0).flatMap(m => [bloco(m), '']),
    `*Total geral: ${p.total} peças*`,
  ].join('\n');
}

/** Planilha do pedido (separador ; — abre direto no Excel). */
export function csvPedido(p: Pedido): string {
  const linhas: (string | number)[][] = [['Modelo', 'Tamanho', 'Inscritos', 'Reserva', 'Total']];
  MODELOS.forEach(m => {
    p.linhas.filter(l => qtd(l, m) > 0).forEach(l =>
      linhas.push([MODELO_LABEL[m], l.tamanho, l.inscritos[m], l.reserva[m], qtd(l, m)]));
    linhas.push([`Total ${MODELO_LABEL[m]}`, '', p.inscritos[m], p.reserva[m], totalModelo(p, m)]);
  });
  linhas.push(['TOTAL GERAL', '', p.inscritos.unissex + p.inscritos.babylook, p.reserva.unissex + p.reserva.babylook, p.total]);
  return linhas.map(r => r.join(';')).join('\n');
}

/** Lista nominal para separação dos kits (uso interno — não vai ao fornecedor). */
export function csvNominal(inscritos: InscritoRow[]): string {
  const header = ['Modelo', 'Tamanho', 'Nº peito', 'Nome', 'Prova', 'Status'];
  const rows = ordenarNominal(inscritos).map(i => [
    MODELO_LABEL[modeloDe(i)], i.camiseta, i.bib_number ?? '', i.nome.replace(/;/g, ','), i.prova, STATUS_LABEL[i.status] ?? i.status,
  ]);
  return [header, ...rows].map(r => r.join(';')).join('\n');
}

export function ordenarNominal(inscritos: InscritoRow[]): InscritoRow[] {
  return [...inscritos].sort((a, b) =>
    MODELOS.indexOf(modeloDe(a)) - MODELOS.indexOf(modeloDe(b)) ||
    ordemTamanho(a.camiseta) - ordemTamanho(b.camiseta) ||
    a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Página HTML enxuta para imprimir ou salvar em PDF e mandar ao fornecedor. */
export function htmlPedido(p: Pedido, observacao: string, titulo = 'Pedido de camisetas'): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cel = (n: number) => (n > 0 ? String(n) : '–');
  const linhas = p.linhas.map(l => `
    <tr><th>${esc(l.tamanho)}</th><td>${cel(qtd(l, 'unissex'))}</td><td>${cel(qtd(l, 'babylook'))}</td><td class="t">${l.total}</td></tr>`).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)} — INO RUN 2026</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:32px}
  h1{font-size:20px;margin:0 0 4px} .sub{color:#555;font-size:13px;margin-bottom:20px}
  table{border-collapse:collapse;width:100%;max-width:520px}
  th,td{border:1px solid #999;padding:8px 12px;text-align:center;font-size:15px}
  thead th{background:#4b2a7b;color:#fff} tfoot td,tfoot th{background:#eee;font-weight:bold} .t{font-weight:bold}
  .obs{margin-top:18px;font-size:13px;white-space:pre-wrap}
  @media print{body{margin:12mm} thead th{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<h1>INO RUN 2026 — ${esc(titulo)}</h1>
<div class="sub">Emitido em ${hoje()} · Quantidades em peças</div>
<table>
  <thead><tr><th>Tamanho</th><th>Unissex</th><th>Baby Look</th><th>Total</th></tr></thead>
  <tbody>${linhas}</tbody>
  <tfoot><tr><th>Total</th><td>${totalModelo(p, 'unissex')}</td><td>${totalModelo(p, 'babylook')}</td><td>${p.total}</td></tr></tfoot>
</table>
${observacao.trim() ? `<div class="obs"><strong>Observações:</strong> ${esc(observacao.trim())}</div>` : ''}
</body></html>`;
}
