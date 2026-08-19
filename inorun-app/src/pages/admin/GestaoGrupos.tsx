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

      {/* Card Informativo — Funcionalidade de Validação de Grupos */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">👥</span>
          <h4 className="font-display font-bold text-[16px] text-emerald-800 uppercase tracking-wide">
            Funcionalidade: Validação de Inscrições em Grupo ( Pix Único )
          </h4>
        </div>
        <div className="text-[13px] text-emerald-700 leading-relaxed space-y-2">
          <p>
            <strong>Objetivo:</strong> Validar inscrições de equipes e assessorias que efetuam um <strong>único pagamento Pix consolidado</strong> referente a múltiplos atletas.
          </p>
          <p>
            <strong>Como Funciona a Verificação:</strong><br />
            1. O responsável envia <strong>1 comprovante Pix</strong> com o valor total consolidado do grupo.<br />
            2. O organizador clica em <strong>"Ver atletas / comprovante"</strong> no grupo desejado abaixo.<br />
            3. O comprovante Pix é exibido diretamente na tela para conferência do valor total.<br />
            4. Ao clicar em <strong>"✓ Confirmar grupo"</strong>, o sistema gera automaticamente o <strong>número de peito (Bib Number)</strong> de <strong>todos os atletas do grupo de uma só vez</strong> e envia os e-mails de confirmação.
          </p>
          <p>
            <strong>Forma Prática de Testar:</strong><br />
            • Para testar, clique em <strong>"Ver atletas / comprovante"</strong> em qualquer grupo pendente abaixo. Você verá a imagem do comprovante único do Pix e a lista completa dos atletas. Clique em <strong>"✓ Confirmar grupo"</strong> para aprovar todos os integrantes em lote.
          </p>
        </div>
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
                    Responsável: <strong>{g.responsavel_nome}</strong> · {g.responsavel_email}{g.responsavel_telefone ? ` · ${g.responsavel_telefone}` : ''}
                  </div>
                  <div className="text-[12px] text-brand-muted mt-1">
                    <strong className="text-brand-purple">{g.qtd_atletas} atletas</strong> · Valor Consolidado Pix: <strong className="text-emerald-700">{formataBRL(g.valor_total_centavos)}</strong>
                    {' · '}{new Date(g.created_at).toLocaleDateString('pt-BR')}
                    {g.status === 'confirmado' && ` · ${g.confirmados} confirmados`}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {g.comprovante_url && (
                    <a href={g.comprovante_url} target="_blank" rel="noreferrer"
                      className="text-[12px] text-brand-purple hover:underline font-medium px-2 py-1">📎 Abrir Comprovante</a>
                  )}
                  <button onClick={() => abrir(g.id)} className="btn-primary text-[12px] py-1.5 px-3">
                    {aberto === g.id ? 'Ocultar detalhes' : 'Ver atletas / comprovante'}
                  </button>
                </div>
              </div>

              {/* Ações Rápidas */}
              {(g.status === 'em_analise' || g.status === 'pendente') && (
                <div className="px-4 pb-4 flex gap-2">
                  <button disabled={processando === g.id} onClick={() => handleAcao(g.id, 'confirmar')}
                    className="btn-primary text-[13px] py-2 px-5 bg-green-600 hover:bg-green-700">
                    {processando === g.id ? '...' : '✓ Confirmar grupo e gerar peitos'}
                  </button>
                  <button disabled={processando === g.id} onClick={() => handleAcao(g.id, 'rejeitar')}
                    className="text-[13px] py-2 px-5 rounded-xl border-2 border-red-200 text-red-500 font-semibold hover:bg-red-50 transition-colors">
                    Rejeitar
                  </button>
                </div>
              )}

              {/* Detalhes expandidos: Comprovante Pix + Lista de Atletas */}
              {aberto === g.id && (
                <div className="border-t border-brand-lilac-mid bg-brand-bg/50 p-4 space-y-4">
                  {/* Pré-visualização do Comprovante Pix Consolidado */}
                  <div className="bg-white border border-brand-lilac-mid rounded-xl p-4">
                    <div className="text-[12px] font-bold text-brand-purple-dark uppercase tracking-wider mb-2">
                      📷 Comprovante Pix do Grupo (Valor Consolidado: {formataBRL(g.valor_total_centavos)})
                    </div>
                    {g.comprovante_url ? (
                      <div className="text-center">
                        <a href={g.comprovante_url} target="_blank" rel="noreferrer">
                          <img
                            src={g.comprovante_url}
                            alt="Comprovante Pix do Grupo"
                            className="max-h-72 mx-auto rounded-xl border border-brand-lilac-mid object-contain hover:opacity-90 transition-opacity bg-white"
                          />
                          <div className="text-[11px] text-brand-purple mt-1 font-medium">🔍 Clique para abrir a imagem em tela cheia</div>
                        </a>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[12px] text-amber-800 text-center">
                        ⚠️ O responsável pelo grupo ainda não anexou o comprovante Pix.
                        {g.responsavel_telefone && (
                          <div className="mt-2">
                            <a
                              href={`https://wa.me/55${g.responsavel_telefone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá, ${g.responsavel_nome}! Estamos aguardando o comprovante do Pix para confirmar a inscrição da equipe ${g.nome_grupo} no INO RUN 2026.`)}`}
                              target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#25D366] text-white font-bold text-[12px]"
                            >
                              💬 Lembrar via WhatsApp
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tabela de atletas */}
                  <div className="overflow-x-auto">
                    <div className="text-[12px] font-bold text-brand-ink uppercase tracking-wider mb-2">
                      🏃 Atletas Integrantes do Grupo ({atletas[g.id]?.length ?? 0} inscritos)
                    </div>
                    <table className="w-full text-[13px] bg-white rounded-xl overflow-hidden border border-brand-lilac-mid">
                      <thead>
                        <tr className="text-brand-muted text-[11px] uppercase tracking-wide bg-brand-bg">
                          {['Nome', 'CPF', 'Prova', 'Categoria', 'Cam.', 'Modelo', 'Bib', 'Status'].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(atletas[g.id] ?? []).map(a => (
                          <tr key={a.registration_id} className="border-t border-brand-lilac-mid hover:bg-brand-lilac/30">
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
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
