// src/lib/precoLoteAtual.ts
// Layer 3 — Módulo puro determinístico
// Regra: preço calculado no servidor no momento da inscrição — front NUNCA define preço

export type ProvaId = '5km' | '10km';

export interface Lote {
  id: string;
  nome: string;
  preco_centavos: number;
  abre_em: Date;
  fecha_em: Date;
  ordem: number;
}

// ─── LOTES OFICIAIS (CONFIRMADOS NO DISCOVERY — 15/06/2026) ─────────────────

export const LOTES_5KM: Lote[] = [
  {
    id: 'lote-5km-1',
    nome: 'Lote 1',
    preco_centavos: 7900,
    abre_em: new Date('2026-01-01T00:00:00-03:00'),
    fecha_em: new Date('2026-07-31T23:59:59-03:00'),
    ordem: 1,
  },
  {
    id: 'lote-5km-2',
    nome: 'Lote 2',
    preco_centavos: 8900,
    abre_em: new Date('2026-08-01T00:00:00-03:00'),
    fecha_em: new Date('2026-09-30T23:59:59-03:00'),
    ordem: 2,
  },
  {
    id: 'lote-5km-3',
    nome: 'Lote 3',
    preco_centavos: 9900,
    abre_em: new Date('2026-10-01T00:00:00-03:00'),
    fecha_em: new Date('2026-10-10T23:59:59-03:00'),
    ordem: 3,
  },
];

export const LOTES_10KM: Lote[] = [
  {
    id: 'lote-10km-1',
    nome: 'Lote 1',
    preco_centavos: 9900,
    abre_em: new Date('2026-01-01T00:00:00-03:00'),
    fecha_em: new Date('2026-07-31T23:59:59-03:00'),
    ordem: 1,
  },
  {
    id: 'lote-10km-2',
    nome: 'Lote 2',
    preco_centavos: 10900,
    abre_em: new Date('2026-08-01T00:00:00-03:00'),
    fecha_em: new Date('2026-09-30T23:59:59-03:00'),
    ordem: 2,
  },
  {
    id: 'lote-10km-3',
    nome: 'Lote 3',
    preco_centavos: 11900,
    abre_em: new Date('2026-10-01T00:00:00-03:00'),
    fecha_em: new Date('2026-10-10T23:59:59-03:00'),
    ordem: 3,
  },
];

export const LOTES_POR_PROVA: Record<ProvaId, Lote[]> = {
  '5km': LOTES_5KM,
  '10km': LOTES_10KM,
};

/**
 * Retorna o lote vigente para uma prova na data informada.
 * @param prova - '5km' ou '10km'
 * @param agora - data atual (default: new Date())
 * @returns Lote vigente ou null se inscrições encerradas/não abertas
 */
export function precoLoteAtual(prova: ProvaId, agora: Date = new Date()): Lote | null {
  const lotes = LOTES_POR_PROVA[prova];
  return lotes.find(l => agora >= l.abre_em && agora <= l.fecha_em) ?? null;
}

/**
 * Formata centavos para string BRL legível.
 * Ex: 7900 → "R$ 79,00"
 */
export function formataBRL(centavos: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(centavos / 100);
}

// ─── TESTES INLINE ──────────────────────────────────────────────────────────
// Chame testPrecoLoteAtual() no console do browser para validar todos os casos.

export function testPrecoLoteAtual(): void {
  const casos: Array<{
    descricao: string;
    prova: ProvaId;
    data: string;
    esperadoNome: string | null;
    esperadoPreco: number | null;
  }> = [
    // 5km — Lote 1 ativo (01/06/2026)
    { descricao: '5km - Lote 1 ativo', prova: '5km', data: '2026-06-01', esperadoNome: 'Lote 1', esperadoPreco: 7900 },
    // 5km — Lote 2 ativo (15/08/2026)
    { descricao: '5km - Lote 2 ativo', prova: '5km', data: '2026-08-15', esperadoNome: 'Lote 2', esperadoPreco: 8900 },
    // 5km — Lote 3 ativo (05/10/2026)
    { descricao: '5km - Lote 3 ativo', prova: '5km', data: '2026-10-05', esperadoNome: 'Lote 3', esperadoPreco: 9900 },
    // 5km — Encerrado (dia da prova, 11/10/2026)
    { descricao: '5km - Encerrado (dia da prova)', prova: '5km', data: '2026-10-11', esperadoNome: null, esperadoPreco: null },
    // 10km — Lote 1 ativo (01/07/2026)
    { descricao: '10km - Lote 1 ativo', prova: '10km', data: '2026-07-01', esperadoNome: 'Lote 1', esperadoPreco: 9900 },
    // 10km — Lote 3 ativo (10/10/2026 — último dia)
    { descricao: '10km - Lote 3 último dia', prova: '10km', data: '2026-10-10', esperadoNome: 'Lote 3', esperadoPreco: 11900 },
    // Entre lotes (gap hipotético — não deve ocorrer com datas corretas)
    { descricao: '5km - Entre lotes (sem gap nos dados reais)', prova: '5km', data: '2025-12-01', esperadoNome: null, esperadoPreco: null },
  ];

  let passou = 0;
  let falhou = 0;

  for (const c of casos) {
    const agora = new Date(c.data + 'T12:00:00-03:00');
    const lote = precoLoteAtual(c.prova, agora);
    const nomeOk = (lote?.nome ?? null) === c.esperadoNome;
    const precoOk = (lote?.preco_centavos ?? null) === c.esperadoPreco;
    const ok = nomeOk && precoOk;

    if (ok) {
      passou++;
      console.log(`✅ [${c.descricao}]: ${lote ? `${lote.nome} - ${formataBRL(lote.preco_centavos)}` : 'null'}`);
    } else {
      falhou++;
      console.error(`❌ [${c.descricao}]:\n   Esperado: ${c.esperadoNome} / ${c.esperadoPreco}\n   Obtido:   ${lote?.nome ?? null} / ${lote?.preco_centavos ?? null}`);
    }
  }

  console.log(`\n📊 precoLoteAtual: ${passou}/${passou + falhou} testes passaram`);
  if (falhou === 0) console.log('🎉 TODOS OS TESTES PASSARAM!');
}
