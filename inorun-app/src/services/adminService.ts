// src/services/adminService.ts
// Layer 2 — Navigation: dados do painel do organizador
// Usa service_role implícito via RLS (acesso completo)

import { supabase } from '../lib/supabase';

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
  bib_number: number | null;
  status: string;
  lote: string;
  preco_centavos: number;
  pagamento: string | null;
  pag_status: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface MetricasAdmin {
  total: number;
  confirmados: number;
  pendentes: number;
  receita_centavos: number;
  inscritos_5km: number;
  inscritos_10km: number;
  vagas_5km: number;
  vagas_10km: number;
}

// Busca todos os inscritos via view vw_inscritos
export async function getInscritos(): Promise<InscritoRow[]> {
  // A view não tem filtro de event — filtramos por prova dentro do evento
  const { data, error } = await supabase
    .from('vw_inscritos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('adminService.getInscritos:', error.message);
    return [];
  }
  return (data ?? []) as InscritoRow[];
}

// Calcula métricas a partir dos inscritos
export function calcularMetricas(inscritos: InscritoRow[]): MetricasAdmin {
  const confirmados = inscritos.filter(i => i.status === 'confirmado');
  return {
    total:             inscritos.length,
    confirmados:       confirmados.length,
    pendentes:         inscritos.filter(i => i.status === 'pendente').length,
    receita_centavos:  confirmados.reduce((acc, i) => acc + (i.preco_centavos ?? 0), 0),
    inscritos_5km:     inscritos.filter(i => i.distancia === 5).length,
    inscritos_10km:    inscritos.filter(i => i.distancia === 10).length,
    vagas_5km:         280,
    vagas_10km:        160,
  };
}

// Gera CSV dos inscritos
export function gerarCSV(inscritos: InscritoRow[]): string {
  const header = [
    'Nome', 'E-mail', 'CPF', 'Sexo', 'Prova', 'Categoria',
    'Camiseta', 'Bib', 'Lote', 'Valor (R$)', 'Pagamento', 'Status', 'Data Inscrição'
  ];
  const rows = inscritos.map(i => [
    i.nome,
    i.email,
    i.cpf,
    i.sexo,
    i.prova,
    i.categoria,
    i.camiseta,
    i.bib_number ?? '',
    i.lote,
    ((i.preco_centavos ?? 0) / 100).toFixed(2).replace('.', ','),
    i.pagamento ?? '',
    i.status,
    new Date(i.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
  ]);
  return [header, ...rows].map(r => r.join(';')).join('\n');
}
