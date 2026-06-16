// src/lib/calcCategoria.ts
// Layer 3 — Módulo puro determinístico
// Regra: categoria derivada de sexo + idade na DATA DA PROVA (11/10/2026), nunca na data de inscrição

export type Sexo = 'M' | 'F';

export interface Categoria {
  label: string;       // ex: "M 30-34"
  sexo: Sexo;
  faixaMin: number;    // idade mínima inclusive
  faixaMax: number;    // idade máxima inclusive, 999 = ilimitado (50+)
}

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
 * Faixas: Sub-20 / 20-24 / 25-29 / 30-34 / 35-39 / 40-44 / 45-49 / 50+
 * @param nascimento - data de nascimento do atleta
 * @param sexo - 'M' ou 'F'
 * @returns string ex: "M 30-34" | "F Sub-20" | "M 50+"
 */
export function calcCategoria(nascimento: Date, sexo: Sexo): string {
  const idade = calcIdadeNaProva(nascimento);

  let faixa: string;
  if (idade < 20) faixa = 'Sub-20';
  else if (idade <= 24) faixa = '20-24';
  else if (idade <= 29) faixa = '25-29';
  else if (idade <= 34) faixa = '30-34';
  else if (idade <= 39) faixa = '35-39';
  else if (idade <= 44) faixa = '40-44';
  else if (idade <= 49) faixa = '45-49';
  else faixa = '50+';

  return `${sexo} ${faixa}`;
}

// ─── TESTES INLINE ──────────────────────────────────────────────────────────
// Chame testCalcCategoria() no console do browser para validar todos os casos.

export function testCalcCategoria(): void {
  const casos: Array<{ nascimento: string; sexo: Sexo; esperado: string }> = [
    // Sub-20: nascido em 12/10/2006 (19 anos na prova)
    { nascimento: '2006-10-12', sexo: 'M', esperado: 'M Sub-20' },
    // Exatamente 20 anos na prova (nasc 11/10/2006)
    { nascimento: '2006-10-11', sexo: 'F', esperado: 'F 20-24' },
    // 24 anos (nasc 01/01/2002)
    { nascimento: '2002-01-01', sexo: 'M', esperado: 'M 20-24' },
    // 25 anos (nasc 10/10/2001)
    { nascimento: '2001-10-10', sexo: 'F', esperado: 'F 25-29' },
    // 30 anos (nasc 11/10/1996)
    { nascimento: '1996-10-11', sexo: 'M', esperado: 'M 30-34' },
    // 34 anos (nasc 12/10/1991 — ainda 33 na prova)
    { nascimento: '1991-10-12', sexo: 'F', esperado: 'F 30-34' },
    // 35 anos (nasc 11/10/1991)
    { nascimento: '1991-10-11', sexo: 'M', esperado: 'M 35-39' },
    // 40 anos (nasc 11/10/1986)
    { nascimento: '1986-10-11', sexo: 'F', esperado: 'F 40-44' },
    // 45 anos (nasc 11/10/1981)
    { nascimento: '1981-10-11', sexo: 'M', esperado: 'M 45-49' },
    // 50 anos exatos (nasc 11/10/1976)
    { nascimento: '1976-10-11', sexo: 'F', esperado: 'F 50+' },
    // 70 anos (nasc 11/10/1956)
    { nascimento: '1956-10-11', sexo: 'M', esperado: 'M 50+' },
  ];

  let passou = 0;
  let falhou = 0;

  for (const c of casos) {
    const resultado = calcCategoria(new Date(c.nascimento), c.sexo);
    const ok = resultado === c.esperado;
    if (ok) {
      passou++;
      console.log(`✅ [${c.nascimento}][${c.sexo}] → ${resultado}`);
    } else {
      falhou++;
      console.error(`❌ [${c.nascimento}][${c.sexo}] → Esperado: ${c.esperado} | Obtido: ${resultado}`);
    }
  }

  console.log(`\n📊 calcCategoria: ${passou}/${passou + falhou} testes passaram`);
  if (falhou === 0) console.log('🎉 TODOS OS TESTES PASSARAM!');
}
