// src/lib/validaCPF.ts
// Layer 3 — Módulo puro determinístico
// Validação de CPF pelo algoritmo dos dois dígitos verificadores (padrão Receita Federal)

/**
 * Remove pontuação e valida um CPF brasileiro.
 * @param cpf - CPF com ou sem pontuação (ex: "123.456.789-09" ou "12345678909")
 * @returns true se CPF for matematicamente válido
 */
export function validaCPF(cpf: string): boolean {
  // Remove tudo que não for dígito
  const digits = cpf.replace(/\D/g, '');

  // Deve ter exatamente 11 dígitos
  if (digits.length !== 11) return false;

  // Rejeita sequências iguais (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(digits)) return false;

  // Calcula primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;

  // Calcula segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits[10])) return false;

  return true;
}

/**
 * Formata um CPF numérico para exibição: "12345678909" → "123.456.789-09"
 * @param cpf - 11 dígitos numéricos
 */
export function formataCPF(cpf: string): string {
  const d = cpf.replace(/\D/g, '');
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

// ─── TESTES INLINE ──────────────────────────────────────────────────────────
// Chame testValidaCPF() no console do browser para validar todos os casos.

export function testValidaCPF(): void {
  const casos: Array<{ cpf: string; esperado: boolean; descricao: string }> = [
    // CPFs válidos
    { cpf: '529.982.247-25', esperado: true, descricao: 'CPF válido com pontuação' },
    { cpf: '52998224725',    esperado: true, descricao: 'CPF válido sem pontuação' },
    { cpf: '111.444.777-35', esperado: true, descricao: 'CPF válido outro exemplo' },
    // Sequências repetidas (inválidas)
    { cpf: '111.111.111-11', esperado: false, descricao: 'Sequência repetida 1' },
    { cpf: '000.000.000-00', esperado: false, descricao: 'Sequência repetida 0' },
    { cpf: '999.999.999-99', esperado: false, descricao: 'Sequência repetida 9' },
    // Dígitos verificadores errados
    { cpf: '529.982.247-26', esperado: false, descricao: 'Primeiro dígito errado' },
    { cpf: '529.982.247-35', esperado: false, descricao: 'Segundo dígito errado' },
    // Tamanho errado
    { cpf: '529.982.247',    esperado: false, descricao: 'Muito curto' },
    { cpf: '529.982.247-255',esperado: false, descricao: 'Muito longo' },
    // Vazio
    { cpf: '',               esperado: false, descricao: 'String vazia' },
  ];

  let passou = 0;
  let falhou = 0;

  for (const c of casos) {
    const resultado = validaCPF(c.cpf);
    const ok = resultado === c.esperado;
    if (ok) {
      passou++;
      console.log(`✅ [${c.descricao}]: ${c.cpf} → ${resultado}`);
    } else {
      falhou++;
      console.error(`❌ [${c.descricao}]: ${c.cpf} → Esperado: ${c.esperado} | Obtido: ${resultado}`);
    }
  }

  console.log(`\n📊 validaCPF: ${passou}/${passou + falhou} testes passaram`);
  if (falhou === 0) console.log('🎉 TODOS OS TESTES PASSARAM!');
}
