// src/services/inscricaoService.ts
// Layer 2 — Navigation: orquestra o fluxo completo de inscrição
// Invariantes do gemini.md:
//   - CPF único por prova (race_id + athlete_id UNIQUE no schema)
//   - Preço calculado no servidor (lote ativo no momento da inscrição)
//   - Categoria derivada de sexo + idade na data da prova
//   - bib_number gerado APÓS pagamento confirmado (confirmar_pagamento_mock)

import { supabase } from '../lib/supabase';
import { calcCategoria } from '../lib/calcCategoria';
import { validaCPF } from '../lib/validaCPF';

export interface DadosAtleta {
  nome: string;
  cpf: string;
  nascimento: string; // YYYY-MM-DD
  sexo: 'M' | 'F';
  email: string;
  telefone?: string;
  contato_emergencia?: string;
}

export interface DadosInscricao {
  race_id: string;
  lot_id: string;
  event_id: string;
  camiseta: 'PP' | 'P' | 'M' | 'G' | 'GG' | 'XG';
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

// ── Passo 1: upsert do atleta (CPF é a chave de negócio) ──────────────────
async function upsertAtleta(dados: DadosAtleta): Promise<string> {
  if (!validaCPF(dados.cpf)) throw new Error('CPF inválido');

  // CPF sem formatação
  const cpfLimpo = dados.cpf.replace(/\D/g, '');

  // Tenta buscar atleta existente pelo CPF
  const { data: existente } = await supabase
    .from('athlete')
    .select('id')
    .eq('cpf', cpfLimpo)
    .single();

  if (existente) return existente.id;

  // Cria novo atleta
  const { data, error } = await supabase
    .from('athlete')
    .insert({
      nome:               dados.nome.trim(),
      cpf:                cpfLimpo,
      nascimento:         dados.nascimento,
      sexo:               dados.sexo,
      email:              dados.email.trim().toLowerCase(),
      telefone:           dados.telefone?.trim() || null,
      contato_emergencia: dados.contato_emergencia?.trim() || null,
    })
    .select('id')
    .single();

  if (error) {
    // CPF duplicado — busca e retorna o existente
    if (error.code === '23505') {
      const { data: dup } = await supabase
        .from('athlete')
        .select('id')
        .eq('cpf', cpfLimpo)
        .single();
      if (dup) return dup.id;
    }
    throw new Error(`Erro ao criar atleta: ${error.message}`);
  }

  return data.id;
}

// ── Passo 2: cria a inscrição ─────────────────────────────────────────────
async function criarRegistration(
  athlete_id: string,
  dados: DadosAtleta,
  inscricao: DadosInscricao
): Promise<string> {
  const categoria = calcCategoria(
    new Date(dados.nascimento),
    dados.sexo
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
    // Inscrição duplicada (CPF já inscrito nesta prova)
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
  // gateway_ref único para idempotência
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
  // 1. Upsert atleta
  const athlete_id = await upsertAtleta(atletaDados);

  // 2. Cria inscrição
  const registration_id = await criarRegistration(athlete_id, atletaDados, inscricaoDados);

  // 3. Cria pagamento
  const gateway_ref = await criarPagamento(registration_id, inscricaoDados);

  // 4. Confirma pagamento mock → gera bib
  const { bib_number } = await confirmarPagamentoMock(gateway_ref);

  const categoria = calcCategoria(
    new Date(atletaDados.nascimento),
    atletaDados.sexo
  );

  return {
    registration_id,
    bib_number,
    categoria,
    atleta_nome:   atletaDados.nome,
    prova_label:   provaDados.label,
    valor_centavos: inscricaoDados.valor_centavos,
    metodo:        inscricaoDados.metodo_pagamento,
    status:        'confirmado',
  };
}
