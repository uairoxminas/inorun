// src/services/inscricaoService.ts
// Layer 2 — Navigation: orquestra o fluxo completo de inscrição
// Invariantes do gemini.md:
//   - CPF único por prova (race_id + athlete_id UNIQUE no schema)
//   - Preço calculado no servidor (lote ativo no momento da inscrição)
//   - Categoria derivada de sexo + idade na data da prova (+ modalidade v2)
//   - bib_number gerado APÓS pagamento confirmado (confirmar_pagamento_mock)

import { supabase } from '../lib/supabase';
import { calcCategoria } from '../lib/calcCategoria';
import type { Modalidade } from '../lib/calcCategoria';
import { validaCPF } from '../lib/validaCPF';

export interface DadosAtleta {
  nome: string;
  cpf: string;
  nascimento: string; // YYYY-MM-DD
  sexo?: 'M' | 'F';  // opcional para Kids e Caminhada
  email: string;
  telefone?: string;
  contato_emergencia?: string;
}

export interface DadosInscricao {
  race_id: string;
  lot_id: string;
  event_id: string;
  modalidade: Modalidade; // v2: 'corrida' | 'kids' | 'caminhada'
  camiseta: 'PP' | 'P' | 'M' | 'G' | 'GG' | 'XG' | '8' | '10' | '12'; // + tamanhos Kids
  cupom_id?: string;
  valor_centavos: number;
  metodo_pagamento: 'pix' | 'cartao';
}

export interface ResultadoInscricao {
  registration_id: string;
  bib_number: number;
  categoria: string;
  atleta_nome: string;
  prova_label: string;
  valor_centavos: number;
  metodo: string;
  status: 'confirmado';
}

// ── Passo 1: upsert do atleta via RPC com SECURITY DEFINER ────────────────
// O role anon NÃO tem SELECT em athlete (dados protegidos por LGPD).
// A função upsert_atleta roda como SECURITY DEFINER e retorna o id.
async function upsertAtleta(dados: DadosAtleta): Promise<string> {
  if (!validaCPF(dados.cpf)) throw new Error('CPF inválido');

  const cpfLimpo = dados.cpf.replace(/\D/g, '');

  const { data, error } = await supabase.rpc('upsert_atleta', {
    p_nome:       dados.nome.trim(),
    p_cpf:        cpfLimpo,
    p_nascimento: dados.nascimento,
    p_sexo:       dados.sexo ?? null,  // null para Kids/Caminhada quando não informado
    p_email:      dados.email.trim().toLowerCase(),
    p_telefone:   dados.telefone?.trim() || null,
    p_emergencia: dados.contato_emergencia?.trim() || null,
  });

  if (error) throw new Error(`Erro ao criar atleta: ${error.message}`);
  if (data?.error) throw new Error(data.error);
  return data.athlete_id as string;
}

// ── Passo 2: cria a inscrição ─────────────────────────────────────────────
// Categoria é derivada no front conforme modalidade, e armazenada como string
// (category_id = text no schema, ex: "M 30-39", "Kids Geral", "Caminhada")
async function criarRegistration(
  athlete_id: string,
  dados: DadosAtleta,
  inscricao: DadosInscricao
): Promise<string> {
  const categoria = calcCategoria(
    new Date(dados.nascimento),
    dados.sexo ?? 'M', // sexo ignorado para Kids/Caminhada (modalidade define categoria)
    inscricao.modalidade
  );

  const { data, error } = await supabase
    .from('registration')
    .insert({
      event_id:    inscricao.event_id,
      race_id:     inscricao.race_id,
      athlete_id,
      lot_id:      inscricao.lot_id,
      category_id: categoria,
      camiseta:    inscricao.camiseta,
      cupom_id:    inscricao.cupom_id || null,
      status:      'pendente',
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Este CPF já está inscrito nesta prova.');
    }
    throw new Error(`Erro ao criar inscrição: ${error.message}`);
  }

  return data.id;
}

// ── Passo 3: cria o pagamento ────────────────────────────────────────────
async function criarPagamento(
  registration_id: string,
  inscricao: DadosInscricao
): Promise<string> {
  const gateway_ref = `mock_${registration_id}_${Date.now()}`;

  const { data, error } = await supabase
    .from('payment')
    .insert({
      registration_id,
      gateway:        'mock',
      metodo:         inscricao.metodo_pagamento,
      valor_centavos: inscricao.valor_centavos,
      status:         'criado',
      gateway_ref,
    })
    .select('gateway_ref')
    .single();

  if (error) throw new Error(`Erro ao criar pagamento: ${error.message}`);
  return data.gateway_ref;
}

// ── Passo 4: confirma o pagamento (mock) e gera o bib ───────────────────
async function confirmarPagamentoMock(gateway_ref: string): Promise<{ bib_number: number }> {
  const { data, error } = await supabase
    .rpc('confirmar_pagamento_mock', { p_gateway_ref: gateway_ref });

  if (error) throw new Error(`Erro ao confirmar pagamento: ${error.message}`);
  if (data?.error) throw new Error(data.error);

  return { bib_number: data.bib_number };
}

// ── Orquestrador principal ─────────────────────────────────────────────────
export async function criarInscricaoCompleta(
  atletaDados: DadosAtleta,
  inscricaoDados: DadosInscricao,
  provaDados: { label: string }
): Promise<ResultadoInscricao> {
  const athlete_id      = await upsertAtleta(atletaDados);
  const registration_id = await criarRegistration(athlete_id, atletaDados, inscricaoDados);
  const gateway_ref     = await criarPagamento(registration_id, inscricaoDados);
  const { bib_number }  = await confirmarPagamentoMock(gateway_ref);

  const categoria = calcCategoria(
    new Date(atletaDados.nascimento),
    atletaDados.sexo ?? 'M', // ignorado para Kids/Caminhada
    inscricaoDados.modalidade
  );

  return {
    registration_id,
    bib_number,
    categoria,
    atleta_nome:    atletaDados.nome,
    prova_label:    provaDados.label,
    valor_centavos: inscricaoDados.valor_centavos,
    metodo:         inscricaoDados.metodo_pagamento,
    status:         'confirmado',
  };
}
