// src/pages/admin/GestaoGrupos.tsx — Gestão de inscrições em grupo (revisão + confirmação)

import { useState, useEffect } from 'react';
import { formataBRL } from '../../lib/precoLoteAtual';
import { getGrupos, getGrupoAtletas, confirmarGrupo } from '../../services/grupoService';
import type { GrupoRow, GrupoAtletaRow } from '../../services/grupoService';

const STATUS_STYLE: Record<string, string> = {
  pendente:   'bg-brand-lilac-mid text-brand-purple-dark',
  em_analise: 'bg-amber-100 text-amber-800',
  confirmado: 'bg-green-100 text-green-700',
  cancelado:  'bg-red-50 text-red-500',
};

const STATUS_LABEL: Record<string, string> = {
  pendente:   'Pendente',
  em_analise: '⏳ Em análise',
  confirmado: '✅ Confirmado',
  cancelado:  '❌ Cancelado',
};

export default function GestaoGrupos() {
  const [grupos, setGrupos]     = useState<GrupoRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [aberto, setAberto]     = useState<string | null>(null);
  const [atletas, setAtletas]   = useState<Record<string, GrupoAtletaRow[]>>({});
  const [processando, setProcessando] = useState<string | null>(null);
  const [copiado, setCopiado]   = useState(false);

  const linkGrupo = `${window.location.origin}/?grupo=1`;
  const copiarLink = async () => {
    try { await navigator.clipboard.writeText(linkGrupo); setCopiado(true); setTimeout(() => setCopiado(false), 3000); }
    catch { /* clipboard indisponível */ }
  };

  const carregar = async () => {
    setLoading(true);
    setGrupos(await getGrupos());
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const abrir = async (id: string) => {
    if (aberto === id) { setAberto(null); return; }
    setAberto(id);
    if (!atletas[id]) {
      const rows = await getGrupoAtletas(id);
      setAtletas(prev => ({ ...prev, [id]: rows }));
    }
  };

  const handleAcao = async (id: string, acao: 'confirmar' | 'rejeitar') => {
    const msg = acao === 'confirmar'
      ? 'Confirmar este grupo? Isso gera o número de peito de todos os atletas e registra a receita.'
      : 'Rejeitar/cancelar este grupo? As inscrições serão canceladas.';
    if (!confirm(msg)) return;
    setProcessando(id);
    const res = await confirmarGrupo(id, acao);
    if (!res.ok) { alert(res.erro ?? 'Erro ao processar grupo'); }
    else {
      if (acao === 'confirmar') {
        const emails = res.emails_enviados;
        alert(`Grupo confirmado! ${res.confirmados ?? ''} atletas com número de peito gerado.` +
          (emails != null ? `\n${emails} email(s) enviado(s) (atletas com email + responsável).` : ''));
      } else {
        alert('Grupo rejeitado. As inscrições foram canceladas.');
      }
      // Recarrega atletas do grupo (bibs atualizados) + lista
      const rows = await getGrupoAtletas(id);
      setAtletas(prev => ({ ...prev, [id]: rows }));
      await carregar();
    }
    setProcessando(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-extrabold italic uppercase text-[32px] text-brand-ink leading-none">Grupos</h2>
        <button onClick={carregar} disabled={loading} className="btn-ghost text-[13px]">
          {loading ? '↺ ...' : '↺ Atualizar'}
        </button>
      </div>

      <div className="bg-brand-lilac rounded-xl px-4 py-3 text-[13px] text-brand-purple-dark">
        Inscrições em grupo (assessorias/equipes). Revise o comprovante e confirme para gerar os números de peito de todos os atletas de uma vez.
      </div>

      {/* Link de compartilhamento da inscrição em grupo */}
      <div className="card p-4">
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand-muted mb-2">
          🔗 Link de inscrição em grupo
        </div>
        <p className="text-[12px] text-brand-muted mb-3">
          Envie este link para assessorias e equipes — ele abre direto o formulário de inscrição em grupo.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <input readOnly value={linkGrupo} onClick={e => (e.target as HTMLInputElement).select()}
            className="input flex-1 min-w-[220px] text-[13px] font-mono py-2" />
          <button onClick={copiarLink}
            className={`px-4 py-2 rounded-xl font-bold text-[13px] min-w-[90px] transition-colors ${copiado ? 'bg-green-500 text-white' : 'bg-brand-purple text-white hover:bg-brand-purple-dark'}`}>
            {copiado ? 'Copiado!' : 'Copiar'}
          </button>
          <a href={`https://wa.me/?text=${encodeURIComponent('Inscreva sua equipe no INO RUN 2026 (10+ atletas por R$89 cada): ' + linkGrupo)}`}
            target="_blank" rel="noreferrer"
            className="px-4 py-2 rounded-xl font-bold text-[13px] bg-[#25D366] text-white hover:bg-[#20ba5a] transition-colors">
            Enviar no WhatsApp
          </a>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-20 bg-brand-lilac rounded-xl animate-pulse" />)}</div>
      ) : grupos.length === 0 ? (
        <div className="p-8 text-center text-brand-muted">Nenhum grupo inscrito ainda.</div>
      ) : (
        <div className="space-y-3">
          {grupos.map(g => (
            <div key={g.id} className="card overflow-hidden">
              {/* Cabeçalho */}
              <div className="p-4 flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-bold text-[18px] text-brand-ink">{g.nome_grupo}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLE[g.status] ?? ''}`}>
                      {STATUS_LABEL[g.status] ?? g.status}
                    </span>
                  </div>
                  <div className="text-[12px] text-brand-muted mt-1">
                    {g.responsavel_nome} · {g.responsavel_email}{g.responsavel_telefone ? ` · ${g.responsavel_telefone}` : ''}
                  </div>
                  <div className="text-[12px] text-brand-muted mt-1">
                    <strong className="text-brand-purple">{g.qtd_atletas} atletas</strong> · Total {formataBRL(g.valor_total_centavos)}
                    {' · '}{new Date(g.created_at).toLocaleDateString('pt-BR')}
                    {g.status === 'confirmado' && ` · ${g.confirmados} confirmados`}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {g.comprovante_url && (
                    <a href={g.comprovante_url} target="_blank" rel="noreferrer"
                      className="text-[12px] text-brand-purple hover:underline font-medium px-2 py-1">📎 Comprovante</a>
                  )}
                  <button onClick={() => abrir(g.id)} className="text-[12px] text-brand-purple hover:underline font-medium px-2 py-1">
                    {aberto === g.id ? 'Ocultar' : 'Ver atletas'}
                  </button>
                </div>
              </div>

              {/* Ações */}
              {(g.status === 'em_analise' || g.status === 'pendente') && (
                <div className="px-4 pb-4 flex gap-2">
                  <button disabled={processando === g.id} onClick={() => handleAcao(g.id, 'confirmar')}
                    className="btn-primary text-[13px] py-2 px-5">
                    {processando === g.id ? '...' : '✓ Confirmar grupo'}
                  </button>
                  <button disabled={processando === g.id} onClick={() => handleAcao(g.id, 'rejeitar')}
                    className="text-[13px] py-2 px-5 rounded-xl border-2 border-red-200 text-red-500 font-semibold hover:bg-red-50 transition-colors">
                    Rejeitar
                  </button>
                </div>
              )}

              {/* Lista de atletas */}
              {aberto === g.id && (
                <div className="border-t border-brand-lilac-mid bg-brand-bg/50 overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-brand-muted text-[11px] uppercase tracking-wide">
                        {['Nome', 'CPF', 'Prova', 'Categoria', 'Cam.', 'Modelo', 'Bib', 'Status'].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(atletas[g.id] ?? []).map(a => (
                        <tr key={a.registration_id} className="border-t border-brand-lilac-mid">
                          <td className="px-3 py-2 font-medium text-brand-ink">{a.nome}</td>
                          <td className="px-3 py-2 text-brand-muted">{a.cpf}</td>
                          <td className="px-3 py-2 text-brand-muted">{a.prova}</td>
                          <td className="px-3 py-2 text-brand-muted">{a.categoria}</td>
                          <td className="px-3 py-2 text-brand-muted">{a.camiseta}</td>
                          <td className="px-3 py-2 text-brand-muted">{a.camiseta_modelo === 'babylook' ? 'Baby Look' : 'Unissex'}</td>
                          <td className="px-3 py-2 font-bold text-brand-purple">{a.bib_number ?? '—'}</td>
                          <td className="px-3 py-2 text-brand-muted">{a.status}</td>
                        </tr>
                      ))}
                      {(atletas[g.id] ?? []).length === 0 && (
                        <tr><td colSpan={8} className="px-3 py-4 text-center text-brand-muted">Carregando atletas...</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
