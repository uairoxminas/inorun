// src/lib/precoGrupo.ts
// Layer 3 — Módulo puro determinístico para inscrição em grupo.
// Regra de negócio: a partir de MIN_GRUPO atletas, cada inscrição custa PRECO_GRUPO_CENTAVOS
// (+ TAXA_GRUPO_CENTAVOS de taxa de plataforma por atleta, somada por cima).

export const MIN_GRUPO            = 10;    // mínimo de atletas para preço de grupo
export const PRECO_GRUPO_CENTAVOS = 8900;  // R$89,00 por atleta
export const TAXA_GRUPO_CENTAVOS  = 500;   // R$5,00 de taxa por atleta

export interface ResumoGrupo {
  qtd: number;
  subtotal_inscricoes_centavos: number; // qtd * preço
  subtotal_taxas_centavos: number;      // qtd * taxa
  total_centavos: number;               // subtotal + taxas
  atinge_minimo: boolean;
}

/** Calcula o resumo financeiro de um grupo com `qtd` atletas. */
export function calcResumoGrupo(qtd: number): ResumoGrupo {
  const n = Math.max(0, Math.floor(qtd));
  const subtotal_inscricoes_centavos = n * PRECO_GRUPO_CENTAVOS;
  const subtotal_taxas_centavos      = n * TAXA_GRUPO_CENTAVOS;
  return {
    qtd: n,
    subtotal_inscricoes_centavos,
    subtotal_taxas_centavos,
    total_centavos: subtotal_inscricoes_centavos + subtotal_taxas_centavos,
    atinge_minimo: n >= MIN_GRUPO,
  };
}

// ─── TESTES INLINE ──────────────────────────────────────────────────────────
// Chame testPrecoGrupo() no console do browser para validar.
export function testPrecoGrupo(): void {
  const casos: Array<{ qtd: number; total: number; ok: boolean }> = [
    { qtd: 10, total: 94000, ok: true },   // 10 * (8900 + 500) = 94000
    { qtd: 15, total: 141000, ok: true },  // 15 * 9400
    { qtd: 9,  total: 84600, ok: false },  // abaixo do mínimo
    { qtd: 0,  total: 0,     ok: false },
  ];
  let passou = 0;
  for (const c of casos) {
    const r = calcResumoGrupo(c.qtd);
    const ok = r.total_centavos === c.total && r.atinge_minimo === c.ok;
    if (ok) { passou++; console.log(`✅ qtd=${c.qtd} → ${r.total_centavos} / min=${r.atinge_minimo}`); }
    else console.error(`❌ qtd=${c.qtd}: esperado ${c.total}/${c.ok}, obtido ${r.total_centavos}/${r.atinge_minimo}`);
  }
  console.log(`\n📊 precoGrupo: ${passou}/${casos.length} testes passaram`);
}
