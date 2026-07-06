// src/services/grupoService.ts
// Layer 2 — Navigation: orquestra a inscrição em grupo (assessorias/equipes).
// Cria o grupo + inscrições via RPC, registra o comprovante e (no admin) confirma.

import { supabase } from '../lib/supabase';

export interface AtletaGrupo {
  nome: string;
  cpf: string;         // com ou sem máscara — o servidor limpa
  nascimento: string;  // YYYY-MM-DD
  sexo: 'M' | 'F';
  email: string;       // opcional na UI, mas string vazia é aceita
  telefone: string;
  camiseta: string;
  camiseta_modelo: 'unissex' | 'babylook';
  race_id: string;
  categoria: string;   // calculada no cliente (calcCategoria)
}

export interface DadosGrupo {
  nome_grupo: string;
  responsavel_nome: string;
  responsavel_email: string;
  responsavel_telefone: string;
}

export interface GrupoCriado {
  group_id: string;
  qtd_atletas: number;
  valor_total_centavos: number;
}

export interface GrupoRow {
  id: string;
  nome_grupo: string;
  responsavel_nome: string;
  responsavel_email: string;
  responsavel_telefone: string | null;
  qtd_atletas: number;
  preco_unitario_centavos: number;
  taxa_unitaria_centavos: number;
  valor_total_centavos: number;
  status: string;
  comprovante_url: string | null;
  created_at: string;
  confirmados: number;
}

export interface GrupoAtletaRow {
  group_id: string;
  registration_id: string;
  nome: string;
  cpf: string;
  email: string;
  sexo: string;
  prova: string;
  distancia_km: number;
  categoria: string;
  camiseta: string;
  camiseta_modelo: string;
  bib_number: number | null;
  status: string;
}

/** Cria o grupo + inscrições pendentes + pagamentos. Lança erro em caso de falha. */
export async function criarInscricaoGrupo(
  grupo: DadosGrupo,
  atletas: AtletaGrupo[]
): Promise<GrupoCriado> {
  const { data, error } = await supabase.rpc('criar_inscricao_grupo', {
    p_grupo: grupo,
    p_atletas: atletas,
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return {
    group_id: data.group_id,
    qtd_atletas: data.qtd_atletas,
    valor_total_centavos: data.valor_total_centavos,
  };
}

/** Salva a URL do comprovante consolidado e move o grupo para 'em_analise'. */
export async function registrarComprovanteGrupo(
  group_id: string,
  url: string
): Promise<void> {
  const { data, error } = await supabase.rpc('registrar_comprovante_grupo', {
    p_group_id: group_id,
    p_url: url,
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
}

/** Faz upload do comprovante para o Storage e retorna a URL pública. */
export async function uploadComprovanteGrupo(group_id: string, arquivo: File): Promise<string> {
  const ext = arquivo.name.split('.').pop() || 'jpg';
  const fileName = `grupo-${group_id}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('comprovantes')
    .upload(fileName, arquivo, { contentType: arquivo.type, upsert: true });
  if (error) throw new Error('Falha no upload: ' + error.message);
  const { data } = supabase.storage.from('comprovantes').getPublicUrl(fileName);
  return data.publicUrl;
}

// ── Admin ────────────────────────────────────────────────────────────────────

export async function getGrupos(): Promise<GrupoRow[]> {
  const { data, error } = await supabase.from('vw_grupos').select('*');
  if (error) { console.error('getGrupos:', error.message); return []; }
  return (data ?? []) as GrupoRow[];
}

export async function getGrupoAtletas(group_id: string): Promise<GrupoAtletaRow[]> {
  const { data, error } = await supabase
    .from('vw_grupo_atletas')
    .select('*')
    .eq('group_id', group_id);
  if (error) { console.error('getGrupoAtletas:', error.message); return []; }
  return (data ?? []) as GrupoAtletaRow[];
}

export async function confirmarGrupo(
  group_id: string,
  acao: 'confirmar' | 'rejeitar'
): Promise<{ ok: boolean; erro?: string; confirmados?: number; emails_enviados?: number }> {
  // 1. Tenta via Edge Function admin-confirmar-grupo (confirma + envia emails)
  try {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-confirmar-grupo`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ group_id, acao }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.ok) return { ok: true, confirmados: data.confirmados, emails_enviados: data.emails_enviados };
      if (data.error) return { ok: false, erro: data.error };
    }
  } catch {
    // cai no fallback abaixo
  }

  // 2. Fallback: RPC direto (sem envio de email)
  const { data, error } = await supabase.rpc('confirmar_grupo', {
    p_group_id: group_id,
    p_acao: acao,
  });
  if (error) return { ok: false, erro: error.message };
  if (data?.error) return { ok: false, erro: data.error };
  return { ok: true, confirmados: data?.confirmados };
}
