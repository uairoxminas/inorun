// src/services/eventoService.ts
// Layer 2 — Navigation: busca dados públicos do evento no Supabase
// Leitura pública (anon key). Dados: event, race, pricing_lot.

import { supabase } from '../lib/supabase';

export interface Race {
  id: string;
  distancia_km: number;
  label: string;
  descricao: string;
  vagas_total: number;
}

export interface PricingLot {
  id: string;
  race_id: string;
  nome: string;
  preco_centavos: number;
  abre_em: string;
  fecha_em: string;
  ordem: number;
}

export interface EventoData {
  id: string;
  slug: string;
  nome: string;
  cidade: string;
  uf: string;
  data_prova: string;
  races: Race[];
  lots: PricingLot[];
  totalInscritos: number;
}

// Cache simples em memória para evitar re-fetches desnecessários
let _cache: EventoData | null = null;
let _cacheAt = 0;
const CACHE_TTL = 60_000; // 60s

export async function getEventoPublico(): Promise<EventoData> {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL) return _cache;

  // Busca evento
  const { data: evento, error: eErr } = await supabase
    .from('event')
    .select('*')
    .eq('slug', 'inorun-2026')
    .single();
  if (eErr || !evento) throw new Error('Evento não encontrado');

  // Busca provas
  const { data: races, error: rErr } = await supabase
    .from('race')
    .select('*')
    .eq('event_id', evento.id)
    .order('distancia_km');
  if (rErr) throw rErr;

  // Busca lotes
  const { data: lots, error: lErr } = await supabase
    .from('pricing_lot')
    .select('*')
    .in('race_id', (races ?? []).map(r => r.id))
    .order('ordem');
  if (lErr) throw lErr;

  // Total inscritos confirmados
  const { count } = await supabase
    .from('registration')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', evento.id)
    .eq('status', 'confirmado');

  const result: EventoData = {
    ...evento,
    races: races ?? [],
    lots: lots ?? [],
    totalInscritos: (count ?? 0) + 842, // 842 = baseline fictício para o lançamento
  };

  _cache = result;
  _cacheAt = Date.now();
  return result;
}

// Retorna o lote ativo para uma prova (por race_id)
export function getLoteAtivo(lots: PricingLot[], raceId: string): PricingLot | null {
  const now = new Date();
  return lots
    .filter(l => l.race_id === raceId)
    .filter(l => new Date(l.abre_em) <= now && now <= new Date(l.fecha_em))
    .sort((a, b) => a.ordem - b.ordem)[0] ?? null;
}

// Todos os lotes de uma prova ordenados
export function getLotesDaProva(lots: PricingLot[], raceId: string): PricingLot[] {
  return lots.filter(l => l.race_id === raceId).sort((a, b) => a.ordem - b.ordem);
}

// Valida cupom no Supabase e retorna o desconto em fração (0.10 = 10%)
export async function validarCupom(codigo: string): Promise<{ valido: boolean; desconto: number; id?: string }> {
  const { data } = await supabase
    .from('coupon')
    .select('id, tipo, valor')
    .eq('codigo', codigo.trim().toUpperCase())
    .eq('ativo', true)
    .single();

  if (!data) return { valido: false, desconto: 0 };

  const desconto = data.tipo === 'percentual'
    ? Number(data.valor) / 100
    : 0; // tipo 'fixo' tratado no servidor

  return { valido: true, desconto, id: data.id };
}
