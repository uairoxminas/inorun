// src/pages/admin/GestaoInscricoes.tsx — Gestão de inscrições com drawer de edição

import { useState, useRef, useEffect } from 'react';
import { formataBRL } from '../../lib/precoLoteAtual';
import { cancelarInscricao, excluirInscricao, editarInscricaoCompleta, gerarCSV } from '../../services/adminService';
import type { InscritoRow } from '../../services/adminService';
import { supabase } from '../../lib/supabase';
import { calcCategoria } from '../../lib/calcCategoria';
import type { Modalidade } from '../../lib/calcCategoria';
import { validaCPF, formataCPF } from '../../lib/validaCPF';

const CAMISETAS = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG', '4', '6', '8', '10', '12', '14'];
const STATUS_OPTIONS = ['pendente', 'confirmado', 'cancelado', 'em_analise'];

interface ProvaOpcao { id: string; label: string; tipo: string | null; distancia_km: number; }

// Campos editáveis da inscrição (tudo como texto, do jeito que fica nos inputs)
interface FormEdicao {
  nome: string; cpf: string; nascimento: string; sexo: string; email: string;
  telefone: string; emergencia: string;
  race_id: string; camiseta: string; modelo: string; status: string; bib: string;
}

const soDigitos = (s: string) => s.replace(/\D/g, '');

function formDe(r: InscritoRow): FormEdicao {
  return {
    nome: r.nome ?? '', cpf: soDigitos(r.cpf ?? ''), nascimento: r.nascimento ?? '', sexo: r.sexo ?? '',
    email: r.email ?? '', telefone: r.telefone ?? '', emergencia: r.contato_emergencia ?? '',
    race_id: r.race_id ?? '', camiseta: r.camiseta ?? '', modelo: r.camiseta_modelo ?? 'unissex',
    status: r.status, bib: r.bib_number != null ? String(r.bib_number) : '',
  };
}

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
  const [enviandoComprovanteAdmin, setEnviandoComprovanteAdmin] = useState(false);
  const adminFileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadManualAdmin = async (file: File) => {
    if (!atleta) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Formato inválido. Selecione um print ou foto em JPG, PNG ou WEBP.');
      return;
    }
    setEnviandoComprovanteAdmin(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${atleta.registration_id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('comprovantes')
        .upload(fileName, file, { contentType: file.type, upsert: true });
      if (upErr) throw new Error('Falha no upload do arquivo: ' + upErr.message);

      const { data: urlData } = supabase.storage.from('comprovantes').getPublicUrl(fileName);
      const comprovante_url = urlData.publicUrl;

      // Grava a URL via RPC (SECURITY DEFINER) e fallback direto
      const { error: rpcErr } = await supabase.rpc('salvar_comprovante_url', {
        p_registration_id: atleta.registration_id,
        p_url: comprovante_url,
      });
      if (rpcErr) {
        await supabase.from('registration').update({ comprovante_url }).eq('id', atleta.registration_id);
      }

      setAtleta(prev => prev ? { ...prev, comprovante_url } : null);
      await onRecarregar();
      alert('✅ Comprovante anexado com sucesso na ficha do atleta!');
    } catch (err: any) {
      alert('Erro ao anexar comprovante: ' + (err.message || String(err)));
    } finally {
      setEnviandoComprovanteAdmin(false);
    }
  };

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
  const [excluindo, setExcluindo]       = useState(false);
  const [revisando, setRevisando]       = useState(false);
  const [pag, setPag]                   = useState(1);
  const POR_PAG = 20;

  // Estado do form de edição
  const [form, setForm]           = useState<FormEdicao | null>(null);
  const [provas, setProvas]       = useState<ProvaOpcao[]>([]);
  const [eErro, setEErro]         = useState('');
  const setCampo = (campo: keyof FormEdicao, valor: string) =>
    setForm(prev => (prev ? { ...prev, [campo]: valor } : prev));

  useEffect(() => {
    supabase.from('race').select('id, label, tipo, distancia_km').order('distancia_km')
      .then(({ data }) => setProvas((data ?? []) as ProvaOpcao[]));
  }, []);

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
    setForm(formDe(atleta));
    setEErro('');
    setModoEdicao(true);
  };

  // Categoria que a inscrição terá com os dados do formulário (mesma regra da inscrição pública)
  const categoriaDoForm = (f: FormEdicao): string | null => {
    const prova = provas.find(p => p.id === f.race_id);
    if (!prova || !f.nascimento) return null;
    const tipo = (prova.tipo as Modalidade) || 'corrida';
    if (tipo === 'corrida' && !f.sexo) return null;
    // T12:00 evita a data "voltar um dia" no fuso do Brasil
    return calcCategoria(new Date(`${f.nascimento}T12:00:00`), (f.sexo || 'M') as 'M' | 'F', tipo);
  };

  const handleSalvar = async () => {
    if (!atleta || !form) return;
    const orig = formDe(atleta);
    const f: FormEdicao = { ...form, nome: form.nome.trim(), cpf: soDigitos(form.cpf), email: form.email.trim().toLowerCase(),
      telefone: form.telefone.trim(), emergencia: form.emergencia.trim(), bib: form.bib.trim() };

    if (!f.nome || !f.email || !f.nascimento) { setEErro('Nome, e-mail e data de nascimento são obrigatórios.'); return; }
    if (f.cpf !== orig.cpf && !validaCPF(f.cpf)) { setEErro('CPF inválido.'); return; }
    if (f.bib && !/^\d+$/.test(f.bib)) { setEErro('Número de peito deve ter só algarismos.'); return; }

    // Envia só o que mudou
    const dados: Record<string, string | null> = {};
    if (f.nome !== orig.nome)             dados.nome = f.nome;
    if (f.cpf !== orig.cpf)               dados.cpf = f.cpf;
    if (f.nascimento !== orig.nascimento) dados.nascimento = f.nascimento;
    if (f.sexo !== orig.sexo)             dados.sexo = f.sexo || null;
    if (f.email !== orig.email.trim().toLowerCase()) dados.email = f.email;
    if (f.telefone !== orig.telefone.trim())         dados.telefone = f.telefone || null;
    if (f.emergencia !== orig.emergencia.trim())     dados.contato_emergencia = f.emergencia || null;
    if (f.race_id && f.race_id !== orig.race_id)     dados.race_id = f.race_id;
    if (f.camiseta !== orig.camiseta)     dados.camiseta = f.camiseta || null;
    if (f.camiseta && (f.modelo !== orig.modelo || !atleta.camiseta_modelo)) dados.camiseta_modelo = f.modelo;
    if (!f.camiseta && atleta.camiseta_modelo) dados.camiseta_modelo = null;
    if (f.status !== orig.status)         dados.status = f.status;
    if (f.bib !== orig.bib)               dados.bib_number = f.bib || null;

    // Sexo, nascimento ou prova mudaram → categoria é recalculada
    let categoria = atleta.categoria;
    if ('sexo' in dados || 'nascimento' in dados || 'race_id' in dados) {
      const nova = categoriaDoForm(f);
      if (!nova) { setEErro('Informe o sexo para calcular a categoria da corrida.'); return; }
      if (nova !== atleta.categoria) { dados.categoria = nova; categoria = nova; }
    }

    if (Object.keys(dados).length === 0) { setModoEdicao(false); return; }

    setSalvando(true);
    setEErro('');
    const res = await editarInscricaoCompleta(atleta.registration_id, dados);
    if (res.ok) {
      await onRecarregar();
      const prova = provas.find(p => p.id === f.race_id);
      // Atualiza o atleta local com os novos dados
      setAtleta({
        ...atleta, nome: f.nome, cpf: f.cpf, nascimento: f.nascimento, sexo: f.sexo, email: f.email,
        telefone: f.telefone, contato_emergencia: f.emergencia, race_id: f.race_id || atleta.race_id,
        prova: prova?.label ?? atleta.prova, distancia: prova?.distancia_km ?? atleta.distancia,
        camiseta: f.camiseta, camiseta_modelo: f.camiseta ? f.modelo : undefined,
        status: f.status, bib_number: f.bib ? Number(f.bib) : null, categoria,
      });
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

  const handleExcluir = async () => {
    if (!atleta) return;
    if (!confirm(`Excluir PERMANENTEMENTE a inscrição de ${atleta.nome}? Esta ação não pode ser desfeita.`)) return;
    setExcluindo(true);
    const res = await excluirInscricao(atleta.registration_id);
    if (res.ok) { await onRecarregar(); setAtleta(null); }
    else alert(res.erro ?? 'Erro ao excluir inscrição');
    setExcluindo(false);
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
          // Sem sessão do Supabase Auth, a função exige a chave anon como Bearer (senão responde 401 e o e-mail não sai)
          'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
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

      {/* Seção Informativa & Simulador de Testes do WhatsApp e Comprovantes */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🟢</span>
            <h4 className="font-display font-bold text-[16px] text-emerald-800 uppercase tracking-wide">
              Funcionalidade: Gestão de Comprovantes Pix, Anexo Manual e WhatsApp
            </h4>
          </div>
          <div className="text-[13px] text-emerald-700 leading-relaxed space-y-2">
            <p>
              <strong>Objetivo:</strong> Permitir aos organizadores visualizar e validar comprovantes de pagamento Pix, anexar manualmente prints recebidos de atletas pelo WhatsApp, e enviar mensagens de suporte.
            </p>
            <p>
              <strong>Instruções de Uso:</strong><br />
              1. Filtre as inscrições abaixo por <strong>"Pendentes"</strong> ou <strong>"⏳ Em Análise"</strong>.<br />
              2. Clique no botão <strong>"Ver / Editar"</strong> na linha do atleta.<br />
              3. <strong>Se o atleta anexou no site:</strong> a imagem aparecerá na ficha. Confira os dados e use os botões <strong>"✅ Confirmar"</strong> (para gerar o número de peito) ou <strong>"❌ Rejeitar"</strong>.<br />
              4. <strong>Se o atleta te enviou o print pelo WhatsApp:</strong> clique no botão <strong>"📎 Anexar Comprovante"</strong> dentro da ficha do atleta para salvar a imagem no sistema e depois clique em <strong>"✅ Confirmar"</strong>.<br />
              5. <strong>Se o atleta ainda não enviou:</strong> clique em <strong>"Conversar no WhatsApp"</strong> para mandar uma mensagem direta.
            </p>
            <p>
              <strong>Como Testar de Forma Prática:</strong><br />
              • Abra a ficha de qualquer atleta com status <em>pendente</em> (ex: Carlos Lucio), clique em <strong>"📎 Anexar Comprovante"</strong> e selecione um print de teste para vê-lo salvo na hora.<br />
              • Use o simulador abaixo para enviar uma mensagem de teste do WhatsApp para seu próprio celular!
            </p>
          </div>
        </div>

        {/* Simulador rápido de testes */}
        <div className="bg-white border border-emerald-100 rounded-xl p-4">
          <span className="text-[11px] font-bold uppercase tracking-widest text-brand-muted block mb-3">
            🧪 Área de Teste Prático (Simulador WhatsApp)
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
                    {r.camiseta ? (
                      <>
                        <span className="font-display font-bold text-[12px] bg-brand-lilac text-brand-purple-dark px-2 py-0.5 rounded">
                          {r.camiseta}
                        </span>
                        <span className="block text-[10px] text-brand-muted mt-0.5">
                          {r.camiseta_modelo === 'babylook' ? 'Baby Look' : 'Unissex'}
                        </span>
                      </>
                    ) : (
                      <span className="text-[11px] text-brand-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[13px]">{formataBRL(r.valor_pago ?? r.preco_centavos ?? 0)}</td>
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
                      ['Camiseta',   atleta.camiseta ? `${atleta.camiseta} · ${atleta.camiseta_modelo === 'babylook' ? 'Baby Look' : 'Unissex'}` : 'Sem camiseta'],
                      ['Lote',       atleta.lote ?? '—'],
                      ['Valor pago', formataBRL(atleta.valor_pago ?? atleta.preco_centavos ?? 0)],
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

                  {/* ── REVISÃO MANUAL (status em_analise, pendente com comprovante) ── */}
                  {(atleta.status === 'em_analise' || atleta.status === 'pendente' || (atleta as any).comprovante_url) && (
                    <div className={`border-2 rounded-2xl p-4 mb-4 ${
                      (atleta as any).comprovante_url
                        ? 'bg-amber-50 border-amber-300'
                        : 'bg-yellow-50 border-yellow-300'
                    }`}>
                      <div className="text-[13px] font-bold text-amber-800 mb-3 flex items-center gap-2">
                        <span className="text-xl">{(atleta as any).comprovante_url ? '📄' : '⏳'}</span>
                        {(atleta as any).comprovante_url ? 'Comprovante Pix anexado' : 'Inscrição Aguardando Pix'}
                      </div>
                      {/* Comprovante enviado */}
                      {(atleta as any).comprovante_url && (
                        <div className="mb-4">
                          <div className="text-[11px] text-amber-700 font-semibold mb-2 uppercase tracking-wider">Comprovante enviado pelo atleta</div>
                          <a href={(atleta as any).comprovante_url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={(atleta as any).comprovante_url}
                              alt="Comprovante Pix"
                              className="w-full rounded-xl border border-amber-200 object-contain max-h-64 bg-white hover:opacity-90 transition-opacity"
                            />
                            <div className="text-[11px] text-amber-600 mt-1 text-center font-medium">🔍 Clique para abrir a imagem em tamanho completo</div>
                          </a>
                        </div>
                      )}
                      {!(atleta as any).comprovante_url && atleta.status === 'em_analise' && (
                        <div className="bg-amber-100 rounded-xl p-3 text-[12px] text-amber-700 mb-4 text-center">
                          Imagem do comprovante não disponível.
                          <br />Contate o atleta: <strong>{atleta.email}</strong>
                        </div>
                      )}
                      {!(atleta as any).comprovante_url && atleta.status === 'pendente' && (
                        <div className="bg-yellow-100/80 rounded-xl p-3 text-[12px] text-yellow-800 mb-4">
                          O atleta ainda não enviou o print do comprovante Pix.
                          <br />Você pode cobrar via WhatsApp ou confirmar manualmente se já viu o valor no extrato bancário.
                        </div>
                      )}
                      {(atleta as any).gemini_motivo && (
                        <div className="bg-white border border-amber-200 rounded-xl px-3 py-2 text-[12px] text-amber-800 mb-4">
                          <strong>Análise da IA:</strong> {(atleta as any).gemini_motivo}
                        </div>
                      )}

                      {/* Botão para o Organizador Anexar Comprovante do WhatsApp */}
                      <div className="bg-white/80 border border-amber-200 rounded-xl p-3 mb-4 flex items-center justify-between gap-2 flex-wrap">
                        <div className="text-[12px] text-amber-900 font-medium">
                          {(atleta as any).comprovante_url ? 'Substituir/Reenviar comprovante:' : 'Atleta enviou comprovante no WhatsApp?'}
                        </div>
                        <button
                          type="button"
                          id="btn-anexar-comprovante-admin"
                          onClick={() => adminFileInputRef.current?.click()}
                          disabled={enviandoComprovanteAdmin}
                          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[12px] transition-colors flex items-center gap-1 shadow-sm shrink-0 disabled:opacity-50"
                        >
                          {enviandoComprovanteAdmin ? '⏳ Enviando...' : '📎 Anexar Comprovante'}
                        </button>
                        <input
                          ref={adminFileInputRef}
                          type="file"
                          className="hidden"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadManualAdmin(file);
                            e.target.value = '';
                          }}
                        />
                      </div>

                      {atleta.status !== 'confirmado' && (
                        <div className="grid grid-cols-2 gap-3">
                          <button id="btn-confirmar-manual" onClick={() => handleRevisao('confirmar')}
                            disabled={revisando || enviandoComprovanteAdmin}
                            className="py-3 rounded-xl bg-green-500 text-white font-bold text-[14px] hover:bg-green-600 transition-colors disabled:opacity-50 shadow-sm flex items-center justify-center gap-1">
                            {revisando ? '...' : '✅ Confirmar'}
                          </button>
                          <button id="btn-rejeitar-manual" onClick={() => handleRevisao('rejeitar')}
                            disabled={revisando || enviandoComprovanteAdmin}
                            className="py-3 rounded-xl bg-red-500 text-white font-bold text-[14px] hover:bg-red-600 transition-colors disabled:opacity-50 shadow-sm flex items-center justify-center gap-1">
                            {revisando ? '...' : '❌ Rejeitar'}
                          </button>
                        </div>
                      )}
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
                    {atleta.status === 'cancelado' && (
                      <button id="btn-excluir-inscricao" onClick={handleExcluir}
                        disabled={excluindo}
                        className="w-full py-3 rounded-xl bg-red-600 text-white font-semibold text-[14px] hover:bg-red-700 transition-colors disabled:opacity-50">
                        {excluindo ? 'Excluindo...' : '🗑 Excluir permanentemente'}
                      </button>
                    )}
                  </div>

                </>
              )}

              {/* ── MODO EDIÇÃO ── */}
              {modoEdicao && form && (
                <div className="space-y-4">
                  <div className="bg-brand-lilac rounded-xl p-3 text-[12px] text-brand-purple-dark">
                    Só o que você alterar é gravado. A categoria é recalculada ao mudar sexo, nascimento ou prova.
                  </div>

                  <div className="text-[11px] font-bold uppercase tracking-widest text-brand-muted">Atleta</div>
                  <div>
                    <label className="label" htmlFor="edit-nome">Nome completo</label>
                    <input id="edit-nome" className="input" value={form.nome}
                      onChange={e => setCampo('nome', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label" htmlFor="edit-cpf">CPF</label>
                      <input id="edit-cpf" className="input" inputMode="numeric" value={formataCPF(form.cpf)}
                        onChange={e => setCampo('cpf', soDigitos(e.target.value).slice(0, 11))} />
                    </div>
                    <div>
                      <label className="label" htmlFor="edit-nascimento">Nascimento</label>
                      <input id="edit-nascimento" type="date" className="input" value={form.nascimento}
                        onChange={e => setCampo('nascimento', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Sexo</label>
                    <div className="flex gap-2">
                      {[['M', 'Masculino'], ['F', 'Feminino'], ['', 'Não informado']].map(([v, rotulo]) => (
                        <button key={v || 'nd'} type="button" id={`edit-sexo-${v || 'nd'}`}
                          onClick={() => setCampo('sexo', v)}
                          className={`flex-1 py-2 rounded-xl border-2 font-semibold text-[13px] transition-all ${
                            form.sexo === v
                              ? 'bg-brand-purple text-white border-brand-purple'
                              : 'bg-white text-brand-muted border-brand-lilac-mid hover:border-brand-purple'
                          }`}>{rotulo}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor="edit-email">E-mail</label>
                    <input id="edit-email" type="email" className="input" value={form.email}
                      onChange={e => setCampo('email', e.target.value)} />
                  </div>
                  <div>
                    <label className="label" htmlFor="edit-telefone">Telefone</label>
                    <input id="edit-telefone" className="input" value={form.telefone}
                      onChange={e => setCampo('telefone', e.target.value)} />
                  </div>
                  <div>
                    <label className="label" htmlFor="edit-emergencia">Contato de emergência</label>
                    <input id="edit-emergencia" className="input" value={form.emergencia}
                      onChange={e => setCampo('emergencia', e.target.value)} placeholder="Nome e telefone" />
                  </div>

                  <div className="text-[11px] font-bold uppercase tracking-widest text-brand-muted pt-2">Inscrição</div>
                  <div className="grid grid-cols-[1fr_110px] gap-3">
                    <div>
                      <label className="label" htmlFor="edit-prova">Prova</label>
                      <select id="edit-prova" className="input" value={form.race_id}
                        onChange={e => setCampo('race_id', e.target.value)}>
                        {!provas.some(p => p.id === form.race_id) && <option value={form.race_id}>{atleta.prova}</option>}
                        {provas.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor="edit-bib">Nº de peito</label>
                      <input id="edit-bib" className="input" inputMode="numeric" value={form.bib}
                        onChange={e => setCampo('bib', soDigitos(e.target.value))} placeholder="—" />
                    </div>
                  </div>
                  <div className="text-[12px] text-brand-muted -mt-2">
                    Categoria: <strong className="text-brand-ink">{categoriaDoForm(form) ?? atleta.categoria}</strong>
                    {form.race_id !== (atleta.race_id ?? '') && ' · o lote acompanha a prova nova (mesmo nome de lote)'}
                  </div>
                  <div>
                    <label className="label">Modelo da camiseta</label>
                    <div className="flex gap-2">
                      {[['unissex', 'Unissex'], ['babylook', 'Baby Look']].map(([v, rotulo]) => (
                        <button key={v} type="button" id={`edit-modelo-${v}`} disabled={!form.camiseta}
                          onClick={() => setCampo('modelo', v)}
                          className={`flex-1 py-2 rounded-xl border-2 font-semibold text-[13px] transition-all disabled:opacity-40 ${
                            form.camiseta && form.modelo === v
                              ? 'bg-brand-purple text-white border-brand-purple'
                              : 'bg-white text-brand-muted border-brand-lilac-mid hover:border-brand-purple'
                          }`}>{rotulo}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label">Tamanho da camiseta</label>
                    <div className="flex gap-2 flex-wrap">
                      {['', ...CAMISETAS].map(c => (
                        <button key={c || 'sem'} type="button" id={`edit-camiseta-${c || 'sem'}`}
                          onClick={() => setCampo('camiseta', c)}
                          className={`px-4 py-2 rounded-xl border-2 font-display font-bold text-[15px] transition-all ${
                            form.camiseta === c
                              ? 'bg-brand-purple text-white border-brand-purple'
                              : 'bg-white text-brand-muted border-brand-lilac-mid hover:border-brand-purple'
                          }`}>{c || 'Sem camiseta'}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label">Status da inscrição</label>
                    <div className="flex gap-2">
                      {STATUS_OPTIONS.map(s => (
                        <button key={s} type="button" id={`edit-status-${s}`}
                          onClick={() => setCampo('status', s)}
                          className={`flex-1 py-2 rounded-xl border-2 font-semibold text-[13px] capitalize transition-all ${
                            form.status === s
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
