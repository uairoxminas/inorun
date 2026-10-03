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
  tipo: 'corrida' | 'kids' | 'caminhada'; // v2: distingue modalidades
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

// Todos os lotes públicos de uma prova ordenados.
// Exclui o lote interno "Grupo (10+)" (referência de preço do fluxo de grupo).
export function getLotesDaProva(lots: PricingLot[], raceId: string): PricingLot[] {
  return lots
    .filter(l => l.race_id === raceId && l.nome !== 'Grupo (10+)')
    .sort((a, b) => a.ordem - b.ordem);
}

export interface CupomInfo {
  valido: boolean;
  desconto: number;           // fração para cupom percentual (0.10 = 10%); 0 se fixo
  descontoFixoCentavos: number; // valor em centavos para cupom fixo; 0 se percentual
  id?: string;
}

// Valida cupom no Supabase. Percentual retorna fração; fixo retorna centavos.
export async function validarCupom(codigo: string): Promise<CupomInfo> {
  const { data } = await supabase
    .from('coupon')
    .select('id, tipo, valor')
    .eq('codigo', codigo.trim().toUpperCase())
    .eq('ativo', true)
    .single();

  if (!data) return { valido: false, desconto: 0, descontoFixoCentavos: 0 };

  const percentual = data.tipo === 'percentual';
  return {
    valido: true,
    desconto: percentual ? Number(data.valor) / 100 : 0,
    // coupon.valor do tipo fixo está em reais (20.00 = R$ 20,00)
    descontoFixoCentavos: percentual ? 0 : Math.round(Number(data.valor) * 100),
    id: data.id,
  };
}

// Aplica o cupom ao preço do lote. O fixo nunca deixa a inscrição negativa.
export function aplicarCupom(precoCentavos: number, cupom: CupomInfo | null): number {
  if (!cupom?.valido) return precoCentavos;
  if (cupom.descontoFixoCentavos > 0) return Math.max(0, precoCentavos - cupom.descontoFixoCentavos);
  return Math.round(precoCentavos * (1 - cupom.desconto));
}
