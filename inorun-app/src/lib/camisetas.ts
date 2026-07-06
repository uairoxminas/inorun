// src/lib/camisetas.ts
// Fonte única dos tamanhos de camiseta, alinhada à tabela de medidas oficial.
// Unissex: PP..XGG · Baby Look: P..XGG (sem PP) · Kids: infantis + adulto pequeno.

import type { Modalidade } from './calcCategoria';

export type CamisetaModelo = 'unissex' | 'babylook';

export const CAMISETAS_UNISSEX  = ['PP', 'P', 'M', 'G', 'GG', 'XGG'] as const;
export const CAMISETAS_BABYLOOK = ['P', 'M', 'G', 'GG', 'XGG'] as const;
// Kids: tamanhos infantis (4..14) + adulto pequeno (PP, P, M) para crianças maiores.
export const CAMISETAS_KIDS     = ['4', '6', '8', '10', '12', '14', 'PP', 'P', 'M'] as const;

// Todos os tamanhos que podem existir no banco (para métricas/relatórios).
// Inclui 'XG' por compatibilidade com inscrições antigas.
export const CAMISETAS_TODOS = ['4', '6', '8', '10', '12', '14', 'PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG'];

/** Tamanhos disponíveis conforme modalidade e modelo escolhidos. */
export function tamanhosDisponiveis(
  modalidade: Modalidade | '',
  modelo: CamisetaModelo,
): readonly string[] {
  if (modalidade === 'kids') return CAMISETAS_KIDS;
  return modelo === 'babylook' ? CAMISETAS_BABYLOOK : CAMISETAS_UNISSEX;
}
