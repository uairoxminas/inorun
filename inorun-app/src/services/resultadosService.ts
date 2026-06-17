// src/services/resultadosService.ts — serviço para gerenciamento e busca de resultados do atleta

import { supabase } from '../lib/supabase';

export interface ResultadoRow {
  id: string;
  bib_number: number;
  nome: string;
  sexo: 'M' | 'F';
  distancia_km: number;
  categoria: string;
  tempo_bruto: string;
  tempo_liquido: string;
  pace: string;
  colocacao_geral: number;
  colocacao_sexo: number;
  colocacao_categoria: number;
  created_at?: string;
}

/**
 * Busca resultados individuais de atletas por nome ou número do peito
 */
export async function buscarResultadosAtleta(termo: string): Promise<ResultadoRow[]> {
  const queryLimpa = termo.trim();
  if (!queryLimpa) return [];

  const isNumeric = /^\d+$/.test(queryLimpa);

  let query = supabase
    .from('race_result')
    .select('*');

  if (isNumeric) {
    query = query.eq('bib_number', parseInt(queryLimpa, 10));
  } else {
    query = query.ilike('nome', `%${queryLimpa}%`);
  }

  const { data, error } = await query.order('distancia_km').order('colocacao_geral');
  if (error) {
    console.error('Erro ao buscar resultados do atleta:', error.message);
    return [];
  }

  return (data ?? []) as ResultadoRow[];
}

/**
 * Retorna o ranking completo dos atletas por distância
 */
export async function getResultadosLeaderboard(distanciaKm: number): Promise<ResultadoRow[]> {
  const { data, error } = await supabase
    .from('race_result')
    .select('*')
    .eq('distancia_km', distanciaKm)
    .order('colocacao_geral', { ascending: true });

  if (error) {
    console.error('Erro ao carregar leaderboard de resultados:', error.message);
    return [];
  }

  return (data ?? []) as ResultadoRow[];
}

/**
 * Importa uma lista de resultados no banco de dados via RPC (organizador)
 */
export async function importarResultados(
  resultados: Omit<ResultadoRow, 'id' | 'created_at'>[]
): Promise<{ ok: boolean; erro?: string; importados?: number }> {
  const { data, error } = await supabase.rpc('admin_importar_resultados', {
    p_resultados: resultados
  });

  if (error) {
    console.error('Erro ao importar resultados (RPC):', error.message);
    return { ok: false, erro: error.message };
  }

  return data as { ok: boolean; erro?: string; importados?: number };
}

/**
 * Limpa todos os resultados de uma distância ou de todas do banco (organizador)
 */
export async function limparResultados(distanciaKm?: number): Promise<{ ok: boolean; erro?: string }> {
  const { data, error } = await supabase.rpc('admin_limpar_resultados', {
    p_distancia: distanciaKm ?? null
  });

  if (error) {
    console.error('Erro ao limpar resultados (RPC):', error.message);
    return { ok: false, erro: error.message };
  }

  return data as { ok: boolean; erro?: string };
}
