// src/services/adminService.ts — serviço completo do painel do organizador

import { supabase } from '../lib/supabase';
import { formataBRL } from '../lib/precoLoteAtual';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface InscritoRow {
  registration_id: string;
  nome: string;
  email: string;
  cpf: string;
  sexo: string;
  distancia: number;
  prova: string;
  categoria: string;
  camiseta: string;
  camiseta_modelo?: string;
  bib_number: number | null;
  status: string;
  lote: string;
  preco_centavos: number;
  pagamento: string | null;
  pag_status: string | null;
  paid_at: string | null;
  checked_in_at: string | null;
  created_at: string;
  // Campos do comprovante Pix (para revisão manual)
  comprovante_url?: string | null;
  comprovante_mime?: string | null;
  gemini_motivo?: string | null;
  gemini_resultado?: string | null;
  telefone?: string; // Telefone do atleta cadastrado
}

export interface MetricasAdmin {
  total: number;
  confirmados: number;
  pendentes: number;
  cancelados: number;
  checkins: number;
  receita_centavos: number;
  inscritos_5km: number;
  inscritos_10km: number;
  vagas_5km: number;
  vagas_10km: number;
  por_camiseta: Record<string, { total: number; km5: number; km10: number }>;
  por_categoria: Record<string, number>;
  por_lote: Record<string, number>;
  por_dia: { data: string; total: number }[];
}

export interface LoteRow {
  id: string;
  race_id: string;
  nome: string;
  preco_centavos: number;
  abre_em: string;
  fecha_em: string;
  ordem: number;
  ativo: boolean;
  prova: string;
}

export interface CupomRow {
  id: string;
  codigo: string;
  tipo: string;
  valor: number;
  ativo: boolean;
  validade: string;
  usos: number;
}

export interface FinanceiroRow {
  id: string;
  evento_id: string;
  tipo: 'receita' | 'despesa';
  categoria: string;
  descricao: string;
  valor_centavos: number;
  data_lancamento: string;
  automatico: boolean;
}

export interface WaveRow {
  id: string;
  race_id: string;
  nome: string;
  categorias: string[];
  largada_at: string;
  ordem: number;
  cor: string;
  prova?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// INSCRITOS
// ─────────────────────────────────────────────────────────────────────────────

export async function getInscritos(): Promise<InscritoRow[]> {
  const { data, error } = await supabase
    .from('vw_inscritos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error('getInscritos:', error.message); return []; }
  return (data ?? []) as InscritoRow[];
}

export function calcularMetricas(inscritos: InscritoRow[]): MetricasAdmin {
  const confirmados = inscritos.filter(i => i.status === 'confirmado');
  const pendentes   = inscritos.filter(i => i.status === 'pendente');
  const cancelados  = inscritos.filter(i => i.status === 'cancelado');
  const checkins    = inscritos.filter(i => i.checked_in_at);

  // Por camiseta — inclui tamanhos Kids (8, 10, 12) e adultos
  const CAMISETAS_TODOS = ['4', '6', '8', '10', '12', '14', 'PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG'];
  const por_camiseta: MetricasAdmin['por_camiseta'] = {};
  CAMISETAS_TODOS.forEach(c => {
    const grupo = inscritos.filter(i => i.camiseta === c && i.status !== 'cancelado');
    if (grupo.length === 0) return; // omite tamanhos sem inscrição
    por_camiseta[c] = {
      total: grupo.length,
      km5:  grupo.filter(i => i.distancia === 5).length,
      km10: grupo.filter(i => i.distancia === 10).length,
    };
  });

  // Por categoria
  const por_categoria: Record<string, number> = {};
  inscritos.filter(i => i.status !== 'cancelado').forEach(i => {
    por_categoria[i.categoria] = (por_categoria[i.categoria] ?? 0) + 1;
  });

  // Por lote
  const por_lote: Record<string, number> = {};
  inscritos.filter(i => i.status !== 'cancelado').forEach(i => {
    const l = i.lote ?? 'Sem lote';
    por_lote[l] = (por_lote[l] ?? 0) + 1;
  });

  // Por dia (últimos 30 dias)
  const por_dia_map: Record<string, number> = {};
  inscritos.forEach(i => {
    const d = i.created_at?.slice(0, 10);
    if (d) por_dia_map[d] = (por_dia_map[d] ?? 0) + 1;
  });
  const por_dia = Object.entries(por_dia_map)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([data, total]) => ({ data, total }));

  return {
    total:             inscritos.length,
    confirmados:       confirmados.length,
    pendentes:         pendentes.length,
    cancelados:        cancelados.length,
    checkins:          checkins.length,
    receita_centavos:  confirmados.reduce((acc, i) => acc + (i.preco_centavos ?? 0), 0),
    inscritos_5km:     inscritos.filter(i => i.distancia === 5  && i.status !== 'cancelado').length,
    inscritos_10km:    inscritos.filter(i => i.distancia === 10 && i.status !== 'cancelado').length,
    vagas_5km:  280,
    vagas_10km: 160,
    por_camiseta,
    por_categoria,
    por_lote,
    por_dia,
  };
}

export function gerarCSV(inscritos: InscritoRow[]): string {
  const header = [
    'Nome','E-mail','CPF','Sexo','Prova','Categoria',
    'Camiseta','Modelo','Bib','Lote','Valor (R$)','Pagamento','Status','Check-in','Data Inscrição'
  ];
  const rows = inscritos.map(i => [
    i.nome, i.email, i.cpf, i.sexo, i.prova, i.categoria,
    i.camiseta, i.camiseta_modelo === 'babylook' ? 'Baby Look' : 'Unissex', i.bib_number ?? '',
    i.lote, ((i.preco_centavos ?? 0) / 100).toFixed(2).replace('.', ','),
    i.pagamento ?? '', i.status,
    i.checked_in_at ? new Date(i.checked_in_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '',
    new Date(i.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
  ]);
  return [header, ...rows].map(r => r.join(';')).join('\n');
}

export async function cancelarInscricao(registration_id: string): Promise<{ ok: boolean; erro?: string }> {
  const { data, error } = await supabase.rpc('admin_cancelar_inscricao', { p_registration_id: registration_id });
  if (error) return { ok: false, erro: error.message };
  return data as { ok: boolean; erro?: string };
}

// Exclui permanentemente uma inscrição (apenas se estiver cancelada)
export async function excluirInscricao(registration_id: string): Promise<{ ok: boolean; erro?: string }> {
  const { data, error } = await supabase.rpc('admin_excluir_inscricao', { p_registration_id: registration_id });
  if (error) return { ok: false, erro: error.message };
  return data as { ok: boolean; erro?: string };
}

export async function editarInscricao(
  registration_id: string,
  campos: { nome?: string; email?: string; telefone?: string; camiseta?: string; status?: string; race_id?: string }
): Promise<{ ok: boolean; erro?: string }> {
  const { data, error } = await supabase.rpc('admin_editar_inscricao', {
    p_registration_id: registration_id,
    p_nome:     campos.nome     ?? null,
    p_email:    campos.email    ?? null,
    p_telefone: campos.telefone ?? null,
    p_camiseta: campos.camiseta ?? null,
    p_status:   campos.status   ?? null,
    p_race_id:  campos.race_id  ?? null,
  });
  if (error) return { ok: false, erro: error.message };
  return data as { ok: boolean; erro?: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// LOTES E CUPONS
// ─────────────────────────────────────────────────────────────────────────────

export async function getLotes(): Promise<LoteRow[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('pricing_lot')
    .select(`*, race:race_id(label)`)
    .order('ordem');

  if (error) { console.error('getLotes:', error.message); return []; }
  return (data ?? []).map((l: any) => ({
    ...l,
    prova: l.race?.label ?? '',
    ativo: new Date(l.abre_em) <= new Date(now) && new Date(now) <= new Date(l.fecha_em),
  }));
}

export async function toggleLote(lot_id: string, ativo: boolean): Promise<{ ok: boolean }> {
  const { data, error } = await supabase.rpc('admin_toggle_lot', { p_lot_id: lot_id, p_ativo: ativo });
  if (error) return { ok: false };
  return data as { ok: boolean };
}

export async function getCupons(): Promise<CupomRow[]> {
  const { data, error } = await supabase.from('vw_cupons').select('*').order('ativo', { ascending: false });
  if (error) { console.error('getCupons:', error.message); return []; }
  return (data ?? []) as CupomRow[];
}

export async function criarCupom(
  codigo: string, tipo: string, valor: number, validade: string
): Promise<{ ok: boolean; erro?: string }> {
  const { data, error } = await supabase.rpc('admin_criar_cupom', {
    p_codigo: codigo, p_tipo: tipo,
    p_valor: valor, p_validade: validade || null,
  });
  if (error) return { ok: false, erro: error.message };
  return data as { ok: boolean; erro?: string };
}

export async function toggleCupom(cupom_id: string, ativo: boolean): Promise<{ ok: boolean }> {
  const { data, error } = await supabase.rpc('admin_toggle_cupom', { p_cupom_id: cupom_id, p_ativo: ativo });
  if (error) return { ok: false };
  return data as { ok: boolean };
}

export async function salvarLote(lote: {
  id?: string; race_id?: string; nome: string;
  preco_centavos: number; abre_em: string; fecha_em: string; ordem?: number;
}): Promise<{ ok: boolean; erro?: string; id?: string }> {
  const { data, error } = await supabase.rpc('admin_salvar_lote', {
    p_id:             lote.id             ?? null,
    p_race_id:        lote.race_id        ?? null,
    p_nome:           lote.nome,
    p_preco_centavos: lote.preco_centavos,
    p_abre_em:        lote.abre_em,
    p_fecha_em:       lote.fecha_em,
    p_ordem:          lote.ordem          ?? null,
  });
  if (error) return { ok: false, erro: error.message };
  return data as { ok: boolean; erro?: string; id?: string };
}

export async function deletarLote(lot_id: string): Promise<{ ok: boolean; erro?: string }> {
  const { data, error } = await supabase.rpc('admin_deletar_lote', { p_lot_id: lot_id });
  if (error) return { ok: false, erro: error.message };
  return data as { ok: boolean; erro?: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// FINANCEIRO
// ─────────────────────────────────────────────────────────────────────────────

export async function getFinanceiro(evento_id: string): Promise<FinanceiroRow[]> {
  const { data, error } = await supabase
    .from('financial_entry')
    .select('*')
    .eq('evento_id', evento_id)
    .order('data_lancamento', { ascending: false });

  if (error) { console.error('getFinanceiro:', error.message); return []; }
  return (data ?? []) as FinanceiroRow[];
}

export interface ResumoFinanceiro {
  total_receitas:  number;
  total_despesas:  number;
  saldo:           number;
  // Taxa de plataforma (Opção B: campo separado em payment → despesa automática)
  receita_bruta_inscricoes:   number; // soma receita categoria 'inscricao'
  taxa_plataforma_total:       number; // soma despesa categoria 'taxa_plataforma'
  receita_liquida_inscricoes:  number; // receita_bruta - taxa
  por_categoria_receita: Record<string, number>;
  por_categoria_despesa: Record<string, number>;
}

export function calcularResumoFinanceiro(entries: FinanceiroRow[]): ResumoFinanceiro {
  const receitas = entries.filter(e => e.tipo === 'receita');
  const despesas = entries.filter(e => e.tipo === 'despesa');
  const total_receitas = receitas.reduce((a, e) => a + e.valor_centavos, 0);
  const total_despesas = despesas.reduce((a, e) => a + e.valor_centavos, 0);

  const por_cat_r: Record<string, number> = {};
  receitas.forEach(e => { por_cat_r[e.categoria] = (por_cat_r[e.categoria] ?? 0) + e.valor_centavos; });

  const por_cat_d: Record<string, number> = {};
  despesas.forEach(e => { por_cat_d[e.categoria] = (por_cat_d[e.categoria] ?? 0) + e.valor_centavos; });

  // Taxa de plataforma (Opção B): isolada do restante das despesas
  const receita_bruta_inscricoes  = por_cat_r['inscricao'] ?? 0;
  const taxa_plataforma_total     = por_cat_d['taxa_plataforma'] ?? 0;
  const receita_liquida_inscricoes = receita_bruta_inscricoes - taxa_plataforma_total;

  return {
    total_receitas, total_despesas,
    saldo: total_receitas - total_despesas,
    receita_bruta_inscricoes,
    taxa_plataforma_total,
    receita_liquida_inscricoes,
    por_categoria_receita: por_cat_r,
    por_categoria_despesa: por_cat_d,
  };
}

export async function lancarFinanceiro(
  evento_id: string, tipo: string, categoria: string, descricao: string,
  valor_centavos: number, data: string
): Promise<{ ok: boolean; erro?: string }> {
  const { data: res, error } = await supabase.rpc('admin_lancar_financeiro', {
    p_evento_id: evento_id, p_tipo: tipo, p_categoria: categoria,
    p_descricao: descricao, p_valor_cents: valor_centavos, p_data: data,
  });
  if (error) return { ok: false, erro: error.message };
  return res as { ok: boolean; erro?: string };
}

export async function deletarLancamento(id: string): Promise<{ ok: boolean }> {
  const { data, error } = await supabase.rpc('admin_deletar_lancamento', { p_id: id });
  if (error) return { ok: false };
  return data as { ok: boolean };
}

// ─────────────────────────────────────────────────────────────────────────────
// CRONOGRAMA
// ─────────────────────────────────────────────────────────────────────────────

export async function getWaves(): Promise<WaveRow[]> {
  const { data, error } = await supabase
    .from('race_wave')
    .select(`*, race:race_id(label)`)
    .order('largada_at');

  if (error) { console.error('getWaves:', error.message); return []; }
  return (data ?? []).map((w: any) => ({ ...w, prova: w.race?.label ?? '' }));
}

export async function salvarOnda(wave: Partial<WaveRow> & { race_id: string }): Promise<{ ok: boolean }> {
  const { data, error } = await supabase.rpc('admin_salvar_onda', {
    p_id:         wave.id ?? null,
    p_race_id:    wave.race_id,
    p_nome:       wave.nome,
    p_categorias: wave.categorias,
    p_largada_at: wave.largada_at,
    p_ordem:      wave.ordem ?? 1,
    p_cor:        wave.cor ?? '#8417AE',
  });
  if (error) return { ok: false };
  return data as { ok: boolean };
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK-IN
// ─────────────────────────────────────────────────────────────────────────────

export async function fazerCheckin(bib: number): Promise<{
  ok: boolean; erro?: string; nome?: string; categoria?: string; prova?: string; camiseta?: string;
}> {
  const { data, error } = await supabase.rpc('fazer_checkin', { p_bib: bib });
  if (error) return { ok: false, erro: error.message };
  return data as ReturnType<typeof fazerCheckin> extends Promise<infer R> ? R : never;
}

// Re-export para uso externo
export { formataBRL };
