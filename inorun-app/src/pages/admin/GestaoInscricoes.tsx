// src/pages/admin/GestaoInscricoes.tsx — Gestão de inscrições com drawer de edição

import { useState } from 'react';
import { formataBRL } from '../../lib/precoLoteAtual';
import { cancelarInscricao, editarInscricao, gerarCSV } from '../../services/adminService';
import type { InscritoRow } from '../../services/adminService';
import { supabase } from '../../lib/supabase';

const CAMISETAS = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG', '4', '6', '8', '10', '12', '14'];
const STATUS_OPTIONS = ['pendente', 'confirmado', 'cancelado', 'em_analise'];

interface Props { inscritos: InscritoRow[]; onRecarregar: () => void; loading: boolean; }

function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    confirmado:  'bg-green-100 text-green-700 border-green-300',
    pendente:    'bg-yellow-100 text-yellow-700 border-yellow-300',
    cancelado:   'bg-red-100 text-red-600 border-red-300',
    em_analise:  'bg-amber-100 text-amber-700 border-amber-300',
  };
  const label: Record<string, string> = { em_analise: '⏳ Em Análise' };
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${map[status] ?? 'bg-brand-lilac text-brand-muted border-brand-lilac-mid'}`}>
      {label[status] ?? status}
    </span>
  );
}

export default function GestaoInscricoes({ inscritos, onRecarregar, loading }: Props) {
  const [busca, setBusca]               = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [testFone, setTestFone]         = useState('');
  const [testMsg, setTestMsg]           = useState('Olá! Esta é uma mensagem de teste do painel administrativo INO RUN 2026. 🏃');

  const getWhatsAppLink = (tel: string, msg: string) => {
    let clean = tel.replace(/\D/g, '');
    if (clean.length === 10 || clean.length === 11) {
      clean = '55' + clean;
    }
    return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
  };
  const [filtroProva, setFiltroProva]   = useState('todos');
  const [atleta, setAtleta]             = useState<InscritoRow | null>(null);
  const [modoEdicao, setModoEdicao]     = useState(false);
  const [salvando, setSalvando]         = useState(false);
  const [cancelando, setCancelando]     = useState(false);
  const [revisando, setRevisando]       = useState(false);
  const [pag, setPag]                   = useState(1);
  const POR_PAG = 20;

  // Estado do form de edição
  const [eNome, setENome]         = useState('');
  const [eEmail, setEEmail]       = useState('');
  const [eTelefone, setETelefone] = useState('');
  const [eCamiseta, setECamiseta] = useState('');
  const [eStatus, setEStatus]     = useState('');
  const [eErro, setEErro]         = useState('');

  const [filtroModalidade, setFiltroModalidade] = useState('todas');

  const filtrados = inscritos.filter(r => {
    const matchB = !busca ||
      r.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      r.email?.toLowerCase().includes(busca.toLowerCase()) ||
      String(r.bib_number ?? '').includes(busca) ||
      r.categoria?.toLowerCase().includes(busca.toLowerCase());
    const matchS = filtroStatus === 'todos' || r.status === filtroStatus;
    const matchP = filtroProva  === 'todos' || String(r.distancia) === filtroProva;
    const matchM = filtroModalidade === 'todas' ||
      (filtroModalidade === 'kids'      && r.categoria === 'Kids Geral') ||
      (filtroModalidade === 'caminhada' && r.categoria === 'Caminhada') ||
      (filtroModalidade === 'corrida'   && r.categoria !== 'Kids Geral' && r.categoria !== 'Caminhada');
    return matchB && matchS && matchP && matchM;
  });

  const paginas  = Math.ceil(filtrados.length / POR_PAG);
  const paginados = filtrados.slice((pag - 1) * POR_PAG, pag * POR_PAG);

  const abrirDrawer = async (r: InscritoRow) => {
    setAtleta(r);
    setModoEdicao(false);
    setEErro('');

    // Se o telefone não veio na view (ex: migração pendente no banco), busca dinamicamente do atleta
    if (!r.telefone) {
      try {
        const { data, error } = await supabase
          .from('registration')
          .select('athlete(telefone)')
          .eq('id', r.registration_id)
          .single();
        if (data && !error) {
          const athlete = data.athlete as any;
          const tel = athlete?.telefone || '';
          setAtleta(prev => prev && prev.registration_id === r.registration_id ? { ...prev, telefone: tel } : prev);
        }
      } catch (err) {
        console.warn('Erro ao buscar telefone do atleta:', err);
      }
    }
  };

  const iniciarEdicao = () => {
    if (!atleta) return;
    setENome(atleta.nome);
    setEEmail(atleta.email);
    setETelefone(atleta.telefone ?? '');
    setECamiseta(atleta.camiseta);
    setEStatus(atleta.status);
    setEErro('');
    setModoEdicao(true);
  };

  const handleSalvar = async () => {
    if (!atleta) return;
    setSalvando(true);
    setEErro('');
    const res = await editarInscricao(atleta.registration_id, {
      nome:     eNome     !== atleta.nome     ? eNome     : undefined,
      email:    eEmail    !== atleta.email    ? eEmail    : undefined,
      telefone: eTelefone || undefined,
      camiseta: eCamiseta !== atleta.camiseta ? eCamiseta : undefined,
      status:   eStatus   !== atleta.status   ? eStatus   : undefined,
    });
    if (res.ok) {
      await onRecarregar();
      // Atualiza o atleta local com os novos dados
      setAtleta({ ...atleta, nome: eNome, email: eEmail, telefone: eTelefone, camiseta: eCamiseta, status: eStatus });
      setModoEdicao(false);
    } else {
      setEErro(res.erro ?? 'Erro ao salvar');
    }
    setSalvando(false);
  };

  const handleCancelar = async () => {
    if (!atleta || !confirm(`Cancelar inscrição de ${atleta.nome}?`)) return;
    setCancelando(true);
    const { ok } = await cancelarInscricao(atleta.registration_id);
    if (ok) { await onRecarregar(); setAtleta(null); }
    setCancelando(false);
  };

  const handleRevisao = async (acao: 'confirmar' | 'rejeitar') => {
    if (!atleta) return;
    const msg = acao === 'confirmar'
      ? `Confirmar pagamento de ${atleta.nome} e gerar número de peito?`
      : `Rejeitar comprovante de ${atleta.nome}? A inscrição voltará para pendente.`;
    if (!confirm(msg)) return;
    setRevisando(true);
    try {
      // Tenta via Edge Function admin-confirmar (envia email automático)
      const { data: { session } } = await supabase.auth.getSession();
      const edgeFnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-confirmar`;
      const res = await fetch(edgeFnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ registration_id: atleta.registration_id, acao }),
      });

      let data: any = null;
      if (res.ok) {
        data = await res.json();
      }

      if (data?.ok) {
        // Edge Function funcionou e enviou email
        alert(acao === 'confirmar'
          ? `✅ Inscrição confirmada! Bib #${data.bib_number}\nEmail enviado ao atleta.`
          : '❌ Comprovante rejeitado. Atleta notificado por email.');
      } else {
        // Fallback: RPC direto (sem email automático)
        const { data: rpc, error: rpcErr } = await supabase.rpc('confirmar_inscricao_manual', {
          p_registration_id: atleta.registration_id,
          p_acao: acao,
        });
        if (rpcErr || rpc?.error) {
          alert('Erro: ' + (rpcErr?.message || rpc?.error));
          return;
        }
        alert(acao === 'confirmar'
          ? `✅ Inscrição confirmada! Bib #${rpc.bib_number}`
          : '❌ Comprovante rejeitado. Inscrição voltou para pendente.');
      }

      await onRecarregar();
      setAtleta(null);
    } catch (e) {
      // Fallback total: RPC direto
      try {
        const { data: rpc, error: rpcErr } = await supabase.rpc('confirmar_inscricao_manual', {
          p_registration_id: atleta.registration_id,
          p_acao: acao,
        });
        if (rpcErr || rpc?.error) {
          alert('Erro: ' + (rpcErr?.message || rpc?.error));
        } else {
          alert(acao === 'confirmar'
            ? `✅ Inscrição confirmada! Bib #${rpc.bib_number}`
            : '❌ Comprovante rejeitado.');
          await onRecarregar();
          setAtleta(null);
        }
      } catch (e2) {
        alert('Erro inesperado: ' + String(e2));
      }
    } finally { setRevisando(false); }
  };

  const handleExport = () => {
    const csv  = gerarCSV(filtrados);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `inorun-inscritos-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-display font-extrabold italic uppercase text-[32px] text-brand-ink leading-none">
          Inscrições
        </h2>
        <button id="btn-exportar-csv-inscricoes" onClick={handleExport}
          className="btn-primary text-[13px] py-2 px-4">
          Exportar CSV ({filtrados.length})
        </button>
      </div>

      {/* Seção Informativa & Simulador de Testes do WhatsApp */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">🟢</span>
          <h4 className="font-display font-bold text-[16px] text-emerald-800 uppercase tracking-wide">
            Funcionalidade: Comunicação via WhatsApp
          </h4>
        </div>
        <p className="text-[13px] text-emerald-700 leading-relaxed mb-4">
          <strong>Objetivo:</strong> Enviar mensagens rápidas de suporte aos atletas diretamente pelo painel (alertas de pagamento Pix pendente, avisos de confirmação ou retirada de kit).<br />
          <strong>Como usar:</strong> Clique em <strong>"Ver / Editar"</strong> na ficha de qualquer atleta na tabela abaixo e clique no botão <strong>"Conversar no WhatsApp"</strong> para abrir a janela de chat com mensagem pré-definida de acordo com os dados do atleta.<br />
          <strong>Como Testar de Forma Prática:</strong> Use o simulador abaixo para enviar uma mensagem de teste com seu próprio número!
        </p>

        {/* Simulador rápido de testes */}
        <div className="bg-white border border-emerald-100 rounded-xl p-4">
          <span className="text-[11px] font-bold uppercase tracking-widest text-brand-muted block mb-3">
            🧪 Área de Teste Prático (Simulador)
          </span>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="label text-[11px] mb-1">Telefone para teste (com DDD)</label>
              <input
                id="whatsapp-test-phone"
                type="text"
                className="input py-2 text-[13px]"
                placeholder="Ex: 48996459791"
                value={testFone}
                onChange={e => setTestFone(e.target.value)}
              />
            </div>
            <div className="flex-[2] min-w-[300px]">
              <label className="label text-[11px] mb-1">Mensagem personalizada de teste</label>
              <textarea
                id="whatsapp-test-message"
                className="input py-2 text-[13px] h-10 resize-none"
                placeholder="Escreva a mensagem aqui..."
                value={testMsg}
                onChange={e => setTestMsg(e.target.value)}
              />
            </div>
            <a
              id="btn-whatsapp-test-send"
              href={getWhatsAppLink(testFone, testMsg)}
              target="_blank"
              rel="noopener noreferrer"
              className={`py-2.5 px-5 rounded-xl font-bold text-[13px] text-white flex items-center gap-2 transition-all duration-200 ${
                testFone.replace(/\D/g, '') ? 'bg-[#25D366] hover:bg-[#20ba5a] cursor-pointer' : 'bg-gray-300 text-gray-500 cursor-not-allowed pointer-events-none'
              }`}
            >
              🚀 Enviar Teste
            </a>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <input id="busca-admin-inscritos" value={busca} onChange={e => { setBusca(e.target.value); setPag(1); }}
          className="input text-[13px] py-2 w-52" placeholder="Buscar nome, bib, e-mail..." />
        <select value={filtroStatus} onChange={e => { setFiltroStatus(e.target.value); setPag(1); }}
          className="input text-[13px] py-2 w-36">
          <option value="todos">Todos status</option>
          <option value="confirmado">Confirmados</option>
          <option value="pendente">Pendentes</option>
          <option value="em_analise">⏳ Em Análise</option>
          <option value="cancelado">Cancelados</option>
        </select>
        <select value={filtroProva} onChange={e => { setFiltroProva(e.target.value); setPag(1); }}
          className="input text-[13px] py-2 w-28">
          <option value="todos">Todas provas</option>
          <option value="5">5 km</option>
          <option value="10">10 km</option>
        </select>
        <select value={filtroModalidade} onChange={e => { setFiltroModalidade(e.target.value); setPag(1); }}
          className="input text-[13px] py-2 w-36">
          <option value="todas">Modalidade</option>
          <option value="corrida">🏃 Corrida</option>
          <option value="kids">🎖️ Kids Geral</option>
          <option value="caminhada">🚶 Caminhada</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="card overflow-x-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {[0,1,2].map(i => <div key={i} className="h-10 bg-brand-lilac rounded animate-pulse" />)}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="p-10 text-center text-brand-muted">
            <div className="text-3xl mb-2">🔍</div>
            Nenhum inscrito encontrado
          </div>
        ) : (
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr className="text-brand-muted text-[11px] uppercase tracking-[0.08em] bg-brand-bg">
                {['Bib','Atleta','Prova','Cat.','Camiseta','Valor','Check-in','Status',''].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginados.map((r, i) => (
                <tr key={i} className="border-t border-brand-lilac-mid hover:bg-brand-lilac/40 transition-colors">
                  <td className="px-3 py-2.5">
                    <span className="font-display font-bold text-brand-purple text-[14px]">{r.bib_number ?? '—'}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-brand-ink">{r.nome}</div>
                    <div className="text-[11px] text-brand-muted">{r.email}</div>
                  </td>
                  <td className="px-3 py-2.5 text-brand-muted">{r.distancia} km</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      r.categoria === 'Kids Geral' ? 'bg-yellow-100 text-yellow-800' :
                      r.categoria === 'Caminhada'  ? 'bg-green-100 text-green-800' :
                      'text-brand-muted'
                    }`}>
                      {r.categoria}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="font-display font-bold text-[12px] bg-brand-lilac text-brand-purple-dark px-2 py-0.5 rounded">
                      {r.camiseta}
                    </span>
                    <span className="block text-[10px] text-brand-muted mt-0.5">
                      {r.camiseta_modelo === 'babylook' ? 'Baby Look' : 'Unissex'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[13px]">{formataBRL(r.preco_centavos ?? 0)}</td>
                  <td className="px-3 py-2.5 text-center">
                    {r.checked_in_at
                      ? <span className="text-green-600 text-[13px]">✓ {new Date(r.checked_in_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      : <span className="text-brand-muted text-[12px]">—</span>}
                  </td>
                  <td className="px-3 py-2.5"><Badge status={r.status} /></td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => abrirDrawer(r)}
                      className="text-[12px] text-brand-purple hover:underline font-medium">
                      Ver / Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginação */}
      {paginas > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={pag === 1} onClick={() => setPag(p => p - 1)} className="btn-ghost text-[13px]">← Anterior</button>
          <span className="text-[13px] text-brand-muted">{pag} / {paginas}</span>
          <button disabled={pag === paginas} onClick={() => setPag(p => p + 1)} className="btn-ghost text-[13px]">Próxima →</button>
        </div>
      )}

      {/* ── Drawer ── */}
      {atleta && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => { setAtleta(null); setModoEdicao(false); }} />
          <div className="w-full max-w-[440px] bg-white shadow-2xl overflow-y-auto animate-slide-in-right">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-display font-extrabold italic uppercase text-[22px] text-brand-ink leading-none">
                    {modoEdicao ? 'Editar inscrição' : 'Ficha do atleta'}
                  </h3>
                  <p className="text-[12px] text-brand-muted mt-0.5">ID: {atleta.registration_id.slice(0,8)}...</p>
                </div>
                <button onClick={() => { setAtleta(null); setModoEdicao(false); }}
                  className="text-brand-muted hover:text-brand-ink text-[24px] leading-none">×</button>
              </div>

              {/* Bib destaque */}
              {atleta.bib_number && (
                <div className="bg-gradient-brand rounded-xl p-4 text-center mb-5">
                  <div className="text-white/70 text-[11px] uppercase tracking-[0.15em]">Número de peito</div>
                  <div className="font-display font-extrabold text-[52px] text-brand-yellow leading-none">{atleta.bib_number}</div>
                  <div className="text-white/70 text-[12px] mt-1">{atleta.categoria} · {atleta.distancia} km</div>
                </div>
              )}

              {/* ── MODO VISUALIZAÇÃO ── */}
              {!modoEdicao && (
                <>
                  <div className="space-y-0 mb-5">
                    {[
                      ['Nome',       atleta.nome],
                      ['E-mail',     atleta.email],
                      ['Telefone',   atleta.telefone ?? '—'],
                      ['CPF',        atleta.cpf ? atleta.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '***.$2.$3-**') : '—'],
                      ['Sexo',       atleta.sexo === 'M' ? 'Masculino' : 'Feminino'],
                      ['Prova',      `${atleta.distancia} km`],
                      ['Categoria',  atleta.categoria],
                      ['Camiseta',   `${atleta.camiseta} · ${atleta.camiseta_modelo === 'babylook' ? 'Baby Look' : 'Unissex'}`],
                      ['Lote',       atleta.lote ?? '—'],
                      ['Valor',      formataBRL(atleta.preco_centavos ?? 0)],
                      ['Pagamento',  atleta.pagamento ?? '—'],
                      ['Pag. Status',atleta.pag_status ?? '—'],
                      ['Status',     atleta.status],
                      ['Check-in',   atleta.checked_in_at
                        ? `✅ ${new Date(atleta.checked_in_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
                        : '❌ Não realizado'],
                      ['Inscrito em', new Date(atleta.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between py-2.5 border-b border-brand-lilac-mid last:border-0">
                        <span className="text-[12px] text-brand-muted uppercase tracking-[0.08em] shrink-0">{k}</span>
                        <span className="text-[13px] text-brand-ink font-medium text-right max-w-[240px] ml-3">{v}</span>
                      </div>
                    ))}
                  </div>

                  {/* ── REVISÃO MANUAL (status em_analise) ── */}
                  {atleta.status === 'em_analise' && (
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 mb-4">
                      <div className="text-[13px] font-bold text-amber-800 mb-3 flex items-center gap-2">
                        <span className="text-xl">⏳</span> Comprovante aguardando revisão
                      </div>
                      {/* Comprovante — busca da pix_receipt via adminService */}
                      {(atleta as any).comprovante_url && (
                        <div className="mb-4">
                          <div className="text-[11px] text-amber-700 font-semibold mb-2 uppercase tracking-wider">Comprovante enviado</div>
                          <a href={(atleta as any).comprovante_url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={(atleta as any).comprovante_url}
                              alt="Comprovante Pix"
                              className="w-full rounded-xl border border-amber-200 object-contain max-h-64 bg-white"
                            />
                            <div className="text-[11px] text-amber-600 mt-1 text-center">Clique para ver em tamanho completo</div>
                          </a>
                        </div>
                      )}
                      {!(atleta as any).comprovante_url && (
                        <div className="bg-amber-100 rounded-xl p-3 text-[12px] text-amber-700 mb-4 text-center">
                          Imagem do comprovante não disponível (pode ter falhado no upload).
                          <br />Contate o atleta: <strong>{atleta.email}</strong>
                        </div>
                      )}
                      {(atleta as any).gemini_motivo && (
                        <div className="bg-white border border-amber-200 rounded-xl px-3 py-2 text-[12px] text-amber-800 mb-4">
                          <strong>Motivo da IA:</strong> {(atleta as any).gemini_motivo}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <button id="btn-confirmar-manual" onClick={() => handleRevisao('confirmar')}
                          disabled={revisando}
                          className="py-3 rounded-xl bg-green-500 text-white font-bold text-[14px] hover:bg-green-600 transition-colors disabled:opacity-50">
                          {revisando ? '...' : '✅ Confirmar'}
                        </button>
                        <button id="btn-rejeitar-manual" onClick={() => handleRevisao('rejeitar')}
                          disabled={revisando}
                          className="py-3 rounded-xl bg-red-500 text-white font-bold text-[14px] hover:bg-red-600 transition-colors disabled:opacity-50">
                          {revisando ? '...' : '❌ Rejeitar'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Ações */}
                  <div className="space-y-2">
                    {atleta.telefone ? (
                      <a
                        id="btn-whatsapp-atleta"
                        href={getWhatsAppLink(atleta.telefone, `Olá, ${atleta.nome}! Entramos em contato referente à sua inscrição na prova de ${atleta.distancia} km do INO RUN 2026.`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-semibold text-[14px] transition-colors flex items-center justify-center gap-2"
                      >
                        <svg viewBox="0 0 32 32" className="w-5 h-5 fill-white">
                          <path d="M16 .5C7.44.5.5 7.44.5 16c0 2.77.72 5.37 1.98 7.63L.5 31.5l8.1-2.12A15.43 15.43 0 0 0 16 31.5C24.56 31.5 31.5 24.56 31.5 16S24.56.5 16 .5zm0 28.18a13.6 13.6 0 0 1-6.93-1.9l-.5-.3-5.18 1.36 1.38-5.04-.33-.52A13.62 13.62 0 0 1 16 2.32c7.54 0 13.68 6.14 13.68 13.68S23.54 29.68 16 29.68zM23.1 19.3c-.38-.19-2.24-1.1-2.59-1.23-.34-.12-.59-.19-.84.19s-.97 1.23-1.19 1.48c-.22.26-.43.29-.81.1-.38-.19-1.62-.6-3.09-1.91-1.14-1.02-1.91-2.27-2.13-2.65-.22-.38-.02-.58.17-.77.17-.17.38-.44.57-.66.19-.22.25-.38.38-.63.13-.26.06-.48-.03-.67-.1-.19-.84-2.04-1.16-2.79-.3-.73-.62-.63-.84-.64h-.72c-.25 0-.66.09-.1 1.03 0 0 .84 2.01 1.93 3.04 1.09 1.03 4.5 3.07 4.5 3.07.77.33 1.5.44 2.09.38.65-.07 2-.82 2.28-1.6.28-.79.28-1.46.2-1.6-.08-.13-.3-.21-.68-.4z"/>
                        </svg>
                        Conversar no WhatsApp
                      </a>
                    ) : (
                      <button
                        disabled
                        className="w-full py-3 rounded-xl bg-gray-100 text-gray-400 font-semibold text-[14px] cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        🚫 Sem telefone cadastrado
                      </button>
                    )}
                    <button id="btn-editar-inscricao" onClick={iniciarEdicao}
                      className="w-full py-3 rounded-xl bg-brand-purple text-white font-semibold text-[14px] hover:bg-brand-purple-dark transition-colors">
                      ✏️ Editar inscrição
                    </button>
                    {atleta.status !== 'cancelado' && (
                      <button id="btn-cancelar-inscricao" onClick={handleCancelar}
                        disabled={cancelando}
                        className="w-full py-3 rounded-xl border-2 border-red-400 text-red-600 font-semibold text-[14px] hover:bg-red-50 transition-colors disabled:opacity-50">
                        {cancelando ? 'Cancelando...' : '⚠️ Cancelar inscrição'}
                      </button>
                    )}
                  </div>

                </>
              )}

              {/* ── MODO EDIÇÃO ── */}
              {modoEdicao && (
                <div className="space-y-4">
                  <div className="bg-brand-lilac rounded-xl p-3 text-[12px] text-brand-purple-dark">
                    Edite os campos abaixo. Campos em branco não serão alterados.
                  </div>

                  <div>
                    <label className="label">Nome completo</label>
                    <input id="edit-nome" className="input" value={eNome}
                      onChange={e => setENome(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">E-mail</label>
                    <input id="edit-email" type="email" className="input" value={eEmail}
                      onChange={e => setEEmail(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Telefone</label>
                    <input id="edit-telefone" className="input" value={eTelefone}
                      onChange={e => setETelefone(e.target.value)}
                      placeholder="(Deixe vazio para não alterar)" />
                  </div>
                  <div>
                    <label className="label">Camiseta</label>
                    <div className="flex gap-2 flex-wrap">
                      {CAMISETAS.map(c => (
                        <button key={c} type="button" id={`edit-camiseta-${c}`}
                          onClick={() => setECamiseta(c)}
                          className={`px-4 py-2 rounded-xl border-2 font-display font-bold text-[15px] transition-all ${
                            eCamiseta === c
                              ? 'bg-brand-purple text-white border-brand-purple'
                              : 'bg-white text-brand-muted border-brand-lilac-mid hover:border-brand-purple'
                          }`}>{c}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label">Status da inscrição</label>
                    <div className="flex gap-2">
                      {STATUS_OPTIONS.map(s => (
                        <button key={s} type="button" id={`edit-status-${s}`}
                          onClick={() => setEStatus(s)}
                          className={`flex-1 py-2 rounded-xl border-2 font-semibold text-[13px] capitalize transition-all ${
                            eStatus === s
                              ? s === 'confirmado' ? 'bg-green-600 text-white border-green-600'
                              : s === 'cancelado'  ? 'bg-red-500 text-white border-red-500'
                              : 'bg-yellow-400 text-brand-ink border-yellow-400'
                              : 'bg-white text-brand-muted border-brand-lilac-mid hover:border-brand-purple'
                          }`}>{s}</button>
                      ))}
                    </div>
                  </div>

                  {eErro && (
                    <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3 text-red-600 text-[13px]">
                      {eErro}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button onClick={() => { setModoEdicao(false); setEErro(''); }}
                      className="flex-1 py-3 rounded-xl border-2 border-brand-lilac-mid text-brand-muted font-semibold text-[14px] hover:border-brand-purple hover:text-brand-purple transition-colors">
                      Cancelar
                    </button>
                    <button id="btn-salvar-edicao-inscricao" onClick={handleSalvar} disabled={salvando}
                      className="flex-1 py-3 rounded-xl bg-brand-purple text-white font-semibold text-[14px] hover:bg-brand-purple-dark transition-colors disabled:opacity-60">
                      {salvando ? 'Salvando...' : '✓ Salvar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
