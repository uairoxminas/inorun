// src/lib/ultimaChamada.ts
// Layer 3 — Módulo puro determinístico: regra do kit no lote "Última Chamada".
// Regra de negócio: inscrições até KIT_COMPLETO_ATE incluem camisa e plaquinha personalizada;
// depois disso (até o fim das inscrições, 10/10) NÃO incluem nenhuma das duas.
// A inscrição em grupo encerra junto com o kit completo.
// Preço e datas do lote ficam no banco (pricing_lot — migration 039).

export const KIT_COMPLETO_ATE = new Date('2026-10-05T23:59:59-03:00');

export const FASES_KIT = [
  { periodo: 'Inscrições até 05/10',          kit: 'COM camisa e plaquinha personalizada',     completo: true  },
  { periodo: 'Inscrições de 06/10 até 10/10', kit: 'SEM camisa e SEM plaquinha personalizada', completo: false },
] as const;

/** true enquanto a inscrição ainda garante camisa e plaquinha personalizada. */
export function kitCompletoDisponivel(agora: Date = new Date()): boolean {
  return agora <= KIT_COMPLETO_ATE;
}

/** Inscrição em grupo fecha junto com o prazo do kit completo. */
export function grupoAberto(agora: Date = new Date()): boolean {
  return kitCompletoDisponivel(agora);
}

// ─── TESTES INLINE ──────────────────────────────────────────────────────────
// Chame testUltimaChamada() no console do browser para validar.
export function testUltimaChamada(): void {
  const casos: Array<{ descricao: string; data: string; esperado: boolean }> = [
    { descricao: 'Lote 2 (01/10) — com kit',           data: '2026-10-01T16:00:00-03:00', esperado: true  },
    { descricao: '05/10 23:59:59 — último segundo',    data: '2026-10-05T23:59:59-03:00', esperado: true  },
    { descricao: '06/10 00:00:00 — já sem kit',        data: '2026-10-06T00:00:00-03:00', esperado: false },
    { descricao: '10/10 — último dia, sem kit',        data: '2026-10-10T12:00:00-03:00', esperado: false },
  ];
  let passou = 0;
  for (const c of casos) {
    const agora = new Date(c.data);
    const ok = kitCompletoDisponivel(agora) === c.esperado && grupoAberto(agora) === c.esperado;
    if (ok) { passou++; console.log(`✅ [${c.descricao}]: ${c.esperado}`); }
    else console.error(`❌ [${c.descricao}]: esperado ${c.esperado}, obtido ${kitCompletoDisponivel(agora)}`);
  }
  console.log(`\n📊 ultimaChamada: ${passou}/${casos.length} testes passaram`);
}
