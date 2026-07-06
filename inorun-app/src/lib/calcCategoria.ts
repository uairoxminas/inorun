// src/lib/calcCategoria.ts
// Layer 3 — Módulo puro determinístico
// Regra: categoria derivada de sexo + idade na DATA DA PROVA (11/10/2026), nunca na data de inscrição
//
// CATEGORIAS v2 — INO RUN 2026:
//   Kids Geral      → até 12 anos (300 metros, todos ganham medalha)
//   Caminhada       → qualquer idade (5 km apenas, sem cronometragem competitiva)
//   M/F Sub-20      → 13 a 19 anos
//   M/F 20-29       → 20 a 29 anos
//   M/F 30-39       → 30 a 39 anos
//   M/F 40-49       → 40 a 49 anos
//   M/F 50+         → 50 anos ou mais

export type Sexo = 'M' | 'F';
export type Modalidade = 'corrida' | 'kids' | 'caminhada';

const DATA_PROVA = new Date('2026-10-11');

/**
 * Calcula a idade do atleta na data da prova.
 * Regra: usa o aniversário do ano da prova.
 */
export function calcIdadeNaProva(nascimento: Date): number {
  const anoProva = DATA_PROVA.getFullYear();
  const mesProva = DATA_PROVA.getMonth();
  const diaProva = DATA_PROVA.getDate();

  const anoNasc = nascimento.getFullYear();
  const mesNasc = nascimento.getMonth();
  const diaNasc = nascimento.getDate();

  let idade = anoProva - anoNasc;

  // Se ainda não fez aniversário no ano da prova até a data da prova
  if (mesNasc > mesProva || (mesNasc === mesProva && diaNasc > diaProva)) {
    idade--;
  }

  return idade;
}

/**
 * Calcula a categoria oficial do atleta.
 *
 * Modalidades especiais:
 *   - 'caminhada' → retorna "Caminhada" independente de idade/sexo
 *   - 'kids'      → retorna "Kids Geral" (para inscrição explícita na prova Kids)
 *
 * Corrida (faixas v2):
 *   Sub-20 (13-19) / 20-29 / 30-39 / 40-49 / 50+
 *   Menor de 13 em prova de corrida → retorna "Kids Geral" (usar modalidade kids, até 12 anos)
 *
 * @param nascimento - data de nascimento do atleta
 * @param sexo - 'M' ou 'F'
 * @param modalidade - 'corrida' (padrão) | 'kids' | 'caminhada'
 * @returns string ex: "M 30-39" | "F Sub-20" | "M 50+" | "Kids Geral" | "Caminhada"
 */
export function calcCategoria(
  nascimento: Date,
  sexo: Sexo,
  modalidade: Modalidade = 'corrida'
): string {
  if (modalidade === 'caminhada') return 'Caminhada';
  if (modalidade === 'kids') return 'Kids Geral';

  const idade = calcIdadeNaProva(nascimento);

  // Menor de 13 em prova de corrida → sugere a categoria Kids (até 12 anos)
  if (idade < 13) return 'Kids Geral';

  let faixa: string;
  if (idade <= 19)      faixa = 'Sub-20';
  else if (idade <= 29) faixa = '20-29';
  else if (idade <= 39) faixa = '30-39';
  else if (idade <= 49) faixa = '40-49';
  else                  faixa = '50+';

  return `${sexo} ${faixa}`;
}

/**
 * Valida se a idade é compatível com a modalidade escolhida.
 * Retorna { valido: true } ou { valido: false, motivo: string }
 */
export function validaIdadeModalidade(
  nascimento: Date,
  modalidade: Modalidade
): { valido: boolean; motivo?: string } {
  const idade = calcIdadeNaProva(nascimento);

  if (modalidade === 'kids') {
    if (idade > 12) return { valido: false, motivo: 'Categoria Kids é para até 12 anos na data da prova. Escolha a prova de corrida.' };
    return { valido: true };
  }

  if (modalidade === 'caminhada') {
    if (idade < 7) return { valido: false, motivo: 'Idade mínima para participar é 7 anos.' };
    return { valido: true };
  }

  // corrida
  if (idade < 13) return { valido: false, motivo: 'Idade mínima para a corrida é 13 anos (11/10/2026). Crianças de até 12 anos devem se inscrever na categoria Kids.' };
  return { valido: true };
}

// ─── TESTES INLINE ──────────────────────────────────────────────────────────
// Chame testCalcCategoria() no console do browser para validar todos os casos.

export function testCalcCategoria(): void {
  const casos: Array<{
    nascimento: string;
    sexo: Sexo;
    modalidade?: Modalidade;
    esperado: string;
    descricao: string;
  }> = [
    // ── Kids (7-12 anos) ──
    { nascimento: '2014-10-11', sexo: 'M', modalidade: 'kids',    esperado: 'Kids Geral',  descricao: '12 anos exatos na prova → Kids' },
    { nascimento: '2019-01-01', sexo: 'F', modalidade: 'kids',    esperado: 'Kids Geral',  descricao: '7 anos na prova → Kids' },
    { nascimento: '2014-10-12', sexo: 'M', modalidade: 'corrida', esperado: 'Kids Geral',  descricao: '11 anos na prova → corrida retorna Kids (deve usar modalidade kids)' },
    // ── Caminhada ──
    { nascimento: '1980-05-20', sexo: 'F', modalidade: 'caminhada', esperado: 'Caminhada', descricao: 'Caminhada → sempre Caminhada' },
    { nascimento: '2010-01-01', sexo: 'M', modalidade: 'caminhada', esperado: 'Caminhada', descricao: 'Criança na Caminhada → Caminhada' },
    // ── Corrida Sub-20 (13-19) ──
    { nascimento: '2007-10-12', sexo: 'M', esperado: 'M Sub-20',  descricao: '18 anos na prova → Sub-20' },
    { nascimento: '2007-10-11', sexo: 'F', esperado: 'F Sub-20',  descricao: '19 anos exatos → Sub-20' },
    // ── Corrida 20-29 ──
    { nascimento: '2006-10-11', sexo: 'M', esperado: 'M 20-29',   descricao: '20 anos exatos → 20-29' },
    { nascimento: '1997-01-15', sexo: 'F', esperado: 'F 20-29',   descricao: '29 anos → 20-29' },
    // ── Corrida 30-39 ──
    { nascimento: '1996-10-11', sexo: 'M', esperado: 'M 30-39',   descricao: '30 anos exatos → 30-39' },
    { nascimento: '1987-06-20', sexo: 'F', esperado: 'F 30-39',   descricao: '39 anos → 30-39' },
    // ── Corrida 40-49 ──
    { nascimento: '1986-10-11', sexo: 'M', esperado: 'M 40-49',   descricao: '40 anos exatos → 40-49' },
    { nascimento: '1977-03-10', sexo: 'F', esperado: 'F 40-49',   descricao: '49 anos → 40-49' },
    // ── Corrida 50+ ──
    { nascimento: '1976-10-11', sexo: 'M', esperado: 'M 50+',     descricao: '50 anos exatos → 50+' },
    { nascimento: '1956-01-01', sexo: 'F', esperado: 'F 50+',     descricao: '70 anos → 50+' },
  ];

  let passou = 0;
  let falhou = 0;

  for (const c of casos) {
    const resultado = calcCategoria(new Date(c.nascimento), c.sexo, c.modalidade);
    const ok = resultado === c.esperado;
    if (ok) {
      passou++;
      console.log(`✅ [${c.descricao}] → ${resultado}`);
    } else {
      falhou++;
      console.error(`❌ [${c.descricao}] → Esperado: ${c.esperado} | Obtido: ${resultado}`);
    }
  }

  console.log(`\n📊 calcCategoria v2: ${passou}/${passou + falhou} testes passaram`);
  if (falhou === 0) console.log('🎉 TODOS OS TESTES PASSARAM!');
}
