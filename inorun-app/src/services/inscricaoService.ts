// src/services/inscricaoService.ts
// Layer 2 — Navigation: orquestra o fluxo de inscricao
// v3 — Fluxo Pix com verificacao por Gemini Vision + email Resend

import { supabase } from '../lib/supabase';
import { calcCategoria } from '../lib/calcCategoria';
import type { Modalidade } from '../lib/calcCategoria';
import { validaCPF } from '../lib/validaCPF';

export interface DadosAtleta {
  nome: string;
  cpf: string;
  nascimento: string;
  sexo?: 'M' | 'F';
  email: string;
  telefone?: string;
  contato_emergencia?: string;
}

export interface DadosInscricao {
  race_id: string;
  lot_id: string;
  event_id: string;
  modalidade: Modalidade;
  camiseta: 'PP' | 'P' | 'M' | 'G' | 'GG' | 'XG' | 'XGG' | '4' | '6' | '8' | '10' | '12' | '14';
  camiseta_modelo: 'unissex' | 'babylook';
  cupom_id?: string;
  valor_centavos: number;
  taxa_plataforma_centavos: number;
  metodo_pagamento: 'pix';
}

export interface InscricaoPendente {
  registration_id: string;
  gateway_ref: string;
  valor_total: number;
  categoria: string;
  atleta_nome: string;
  atleta_email: string;
  prova_label: string;
}

export interface ResultadoInscricao {
  registration_id: string;
  bib_number: number;
  categoria: string;
  atleta_nome: string;
  atleta_email?: string;
  prova_label: string;
  valor_centavos: number;
  metodo: string;
  status: 'confirmado';
}

async function upsertAtleta(dados: DadosAtleta): Promise<string> {
  if (!validaCPF(dados.cpf)) throw new Error('CPF invalido');
  const cpfLimpo = dados.cpf.replace(/\D/g, '');
  const { data, error } = await supabase.rpc('upsert_atleta', {
    p_nome:       dados.nome.trim(),
    p_cpf:        cpfLimpo,
    p_nascimento: dados.nascimento,
    p_sexo:       dados.sexo ?? null,
    p_email:      dados.email.trim().toLowerCase(),
    p_telefone:   dados.telefone?.trim() || null,
    p_emergencia: dados.contato_emergencia?.trim() || null,
  });
  if (error) throw new Error(`Erro ao criar atleta: ${error.message}`);
  if (data?.error) throw new Error(data.error);
  return data.athlete_id as string;
}

async function criarRegistration(
  athlete_id: string,
  dados: DadosAtleta,
  inscricao: DadosInscricao
): Promise<string> {
  const categoria = calcCategoria(
    new Date(dados.nascimento),
    dados.sexo ?? 'M',
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
      camiseta_modelo: inscricao.camiseta_modelo,
      cupom_id:    inscricao.cupom_id || null,
      status:      'pendente',
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('Este CPF ja esta inscrito nesta prova.');
    throw new Error(`Erro ao criar inscricao: ${error.message}`);
  }
  return data.id;
}

async function criarPagamento(
  registration_id: string,
  inscricao: DadosInscricao
): Promise<string> {
  const gateway_ref = `pix_${registration_id}_${Date.now()}`;
  const { error } = await supabase
    .from('payment')
    .insert({
      registration_id,
      gateway:                  'pix_manual',
      metodo:                   'pix',
      valor_centavos:           inscricao.valor_centavos,
      taxa_plataforma_centavos: inscricao.taxa_plataforma_centavos,
      status:                   'criado',
      gateway_ref,
    });
  if (error) throw new Error(`Erro ao criar pagamento: ${error.message}`);
  return gateway_ref;
}

export async function criarInscricaoPendente(
  atletaDados: DadosAtleta,
  inscricaoDados: DadosInscricao,
  provaDados: { label: string }
): Promise<InscricaoPendente> {
  const athlete_id      = await upsertAtleta(atletaDados);
  const registration_id = await criarRegistration(athlete_id, atletaDados, inscricaoDados);
  const gateway_ref     = await criarPagamento(registration_id, inscricaoDados);
  const categoria = calcCategoria(
    new Date(atletaDados.nascimento),
    atletaDados.sexo ?? 'M',
    inscricaoDados.modalidade
  );
  return {
    registration_id,
    gateway_ref,
    valor_total:  inscricaoDados.valor_centavos + inscricaoDados.taxa_plataforma_centavos,
    categoria,
    atleta_nome:  atletaDados.nome,
    atleta_email: atletaDados.email,
    prova_label:  provaDados.label,
  };
}

export async function verificarComprovantePix(
  registration_id: string,
  valor_centavos: number,
  atleta_email: string,
  atleta_nome: string,
  prova_label: string,
  categoria: string,
  imagemBase64: string,
  mimeType: string,
  comprovanteUrl?: string | null
): Promise<{ aprovado: boolean; motivo: string; bib_number?: number; em_analise?: boolean }> {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-pix-receipt`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        registration_id,
        valor_centavos,
        atleta_email,
        atleta_nome,
        prova_label,
        categoria,
        imagem_base64: imagemBase64,
        mime_type: mimeType,
        comprovante_url: comprovanteUrl ?? null,
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erro na verificacao: ${err}`);
  }
  return res.json();
}

