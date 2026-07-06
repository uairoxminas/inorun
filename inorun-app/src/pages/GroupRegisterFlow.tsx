// src/pages/GroupRegisterFlow.tsx — Inscrição em grupo (assessorias/equipes)
// 10+ atletas a R$89 cada (+ R$5 taxa). 1 PIX consolidado → admin confirma.

import { useState, useEffect } from 'react';
import Logo from '../components/Logo';
import { calcCategoria, validaIdadeModalidade } from '../lib/calcCategoria';
import type { Modalidade } from '../lib/calcCategoria';
import { validaCPF, formataCPF } from '../lib/validaCPF';
import { formataBRL } from '../lib/precoLoteAtual';
import { MIN_GRUPO, calcResumoGrupo } from '../lib/precoGrupo';
import { tamanhosDisponiveis } from '../lib/camisetas';
import TabelaMedidasModal from '../components/TabelaMedidasModal';
import { getEventoPublico } from '../services/eventoService';
import type { EventoData } from '../services/eventoService';
import {
  criarInscricaoGrupo, uploadComprovanteGrupo, registrarComprovanteGrupo,
} from '../services/grupoService';
import type { AtletaGrupo } from '../services/grupoService';

interface Props { onBack: () => void; onDone: () => void; }

const PIX_KEY_DISPLAY = '51.950.403/0001-32';
const PIX_KEY         = '51950403000132';
const PIX_NOME        = 'ANA CRISTINA CORREA GOMES';

interface AtletaForm {
  nome: string; cpf: string; nasc: string; sexo: 'M' | 'F' | '';
  email: string; tel: string; race_id: string; camiseta: string;
  camiseta_modelo: 'unissex' | 'babylook';
}

const ATLETA_VAZIO: AtletaForm = {
  nome: '', cpf: '', nasc: '', sexo: '', email: '', tel: '', race_id: '', camiseta: '',
  camiseta_modelo: 'unissex',
};

export default function GroupRegisterFlow({ onBack, onDone }: Props) {
  const [step, setStep]       = useState(1);
  const [evento, setEvento]   = useState<EventoData | null>(null);
  const [loading, setLoading] = useState(true);

  // Grupo / responsável
  const [nomeGrupo, setNomeGrupo]   = useState('');
  const [respNome, setRespNome]     = useState('');
  const [respEmail, setRespEmail]   = useState('');
  const [respTel, setRespTel]       = useState('');
  const [termo, setTermo]           = useState(false);

  // Atletas — começa com MIN_GRUPO linhas
  const [atletas, setAtletas] = useState<AtletaForm[]>(
    Array.from({ length: MIN_GRUPO }, () => ({ ...ATLETA_VAZIO }))
  );

  // Envio
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro]         = useState('');
  const [groupId, setGroupId]   = useState<string | null>(null);
  const [totalCents, setTotalCents] = useState(0);

  // Comprovante
  const [arquivo, setArquivo]   = useState<File | null>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [copiado, setCopiado]   = useState(false);
  const [sucesso, setSucesso]   = useState(false);
  const [verTabela, setVerTabela] = useState(false);

  useEffect(() => {
    getEventoPublico().then(setEvento).finally(() => setLoading(false));
  }, []);

  const races = evento?.races ?? [];
  // Kids não entra na inscrição em grupo — removido do seletor de provas.
  const racesGrupo = races.filter(r => r.tipo !== 'kids');
  const raceById = (id: string) => races.find(r => r.id === id);
  const modalidadeDe = (id: string): Modalidade => (raceById(id)?.tipo as Modalidade) || 'corrida';

  const setAtleta = (i: number, patch: Partial<AtletaForm>) =>
    setAtletas(prev => prev.map((a, idx) => idx === i ? { ...a, ...patch } : a));

  const addAtleta = () => setAtletas(prev => [...prev, { ...ATLETA_VAZIO }]);
  const removeAtleta = (i: number) =>
    setAtletas(prev => prev.length > MIN_GRUPO ? prev.filter((_, idx) => idx !== i) : prev);

  const resumo = calcResumoGrupo(atletas.length);

  // Categoria calculada por atleta
  const categoriaDe = (a: AtletaForm): string => {
    if (!a.nasc || !a.race_id) return '—';
    const mod = modalidadeDe(a.race_id);
    if (mod === 'corrida' && !a.sexo) return '—';
    return calcCategoria(new Date(a.nasc), (a.sexo || 'M') as 'M' | 'F', mod);
  };

  // Validação de uma linha de atleta
  const erroAtleta = (a: AtletaForm): string | null => {
    if (!a.nome.trim()) return 'nome';
    if (!validaCPF(a.cpf)) return 'CPF';
    if (!a.nasc) return 'nascimento';
    if (!a.race_id) return 'prova';
    if (!a.sexo) return 'sexo';
    if (!a.camiseta) return 'camiseta';
    const val = validaIdadeModalidade(new Date(a.nasc), modalidadeDe(a.race_id));
    if (!val.valido) return val.motivo ?? 'idade';
    return null;
  };

  const grupoValido = !!nomeGrupo.trim() && !!respNome.trim() && !!respEmail.trim() && !!respTel.trim() && termo;
  const atletasValidos = atletas.length >= MIN_GRUPO && atletas.every(a => erroAtleta(a) === null);

  // CPFs duplicados dentro do próprio grupo
  const cpfsLimpos = atletas.map(a => a.cpf.replace(/\D/g, ''));
  const temDuplicado = cpfsLimpos.some((c, i) => c && cpfsLimpos.indexOf(c) !== i);

  const handleCriar = async () => {
    if (!atletasValidos || temDuplicado) return;
    setEnviando(true); setErro('');
    try {
      const payload: AtletaGrupo[] = atletas.map(a => ({
        nome: a.nome.trim(),
        cpf: a.cpf.replace(/\D/g, ''),
        nascimento: a.nasc,
        sexo: (a.sexo || 'M') as 'M' | 'F',
        email: a.email.trim().toLowerCase(),
        telefone: a.tel.trim(),
        camiseta: a.camiseta,
        camiseta_modelo: a.camiseta_modelo,
        race_id: a.race_id,
        categoria: categoriaDe(a),
      }));
      const res = await criarInscricaoGrupo(
        {
          nome_grupo: nomeGrupo.trim(),
          responsavel_nome: respNome.trim(),
          responsavel_email: respEmail.trim().toLowerCase(),
          responsavel_telefone: respTel.trim(),
        },
        payload,
      );
      setGroupId(res.group_id);
      setTotalCents(res.valor_total_centavos);
      setStep(3);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao criar inscrição do grupo.');
    } finally {
      setEnviando(false);
    }
  };

  const handleArquivo = (file: File) => {
    if (file.size > 5 * 1024 * 1024) { setErro('Arquivo muito grande. Máximo 5 MB.'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErro('Formato inválido. Use JPG, PNG ou WEBP (print do comprovante).'); return;
    }
    setErro(''); setArquivo(file);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleEnviarComprovante = async () => {
    if (!arquivo || !groupId) return;
    setEnviando(true); setErro('');
    try {
      const url = await uploadComprovanteGrupo(groupId, arquivo);
      await registrarComprovanteGrupo(groupId, url);
      setSucesso(true);
      setStep(4);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao enviar comprovante.');
    } finally {
      setEnviando(false);
    }
  };

  const copiarChave = async () => {
    await navigator.clipboard.writeText(PIX_KEY);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  };

  if (loading) return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <div className="text-brand-muted text-[15px] animate-pulse">Carregando evento...</div>
    </div>
  );

  return (
    <div className="bg-brand-bg text-brand-ink font-sans min-h-screen">
      <div className="mx-auto px-5 py-6 max-w-[880px]">

        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={step === 1 ? onBack : () => setStep(s => Math.max(1, s - 1))}
            className="btn-ghost">
            {step === 1 ? '← Voltar ao site' : '← Voltar'}
          </button>
          <Logo height={28} />
        </div>

        {/* Info */}
        <div className="mt-5 bg-brand-lilac border border-brand-lilac-mid rounded-xl px-4 py-3 text-[13px] text-brand-purple-dark">
          <strong>Inscrição em Grupo — INO RUN 2026.</strong> A partir de {MIN_GRUPO} atletas,
          cada inscrição sai por <strong>{formataBRL(8900)}</strong> (+ {formataBRL(500)} de taxa por atleta).
          Pagamento em um único Pix consolidado.
        </div>

        {/* Progress */}
        <div className="mt-4 flex gap-1.5">
          {['Grupo', 'Atletas', 'Pagamento', 'Pronto'].map((_, i) => (
            <div key={i} className={`flex-1 h-1 rounded-full transition-all duration-300 ${i < step ? 'bg-brand-purple' : 'bg-brand-lilac-mid'}`} />
          ))}
        </div>

        {/* ── STEP 1: Dados do grupo ── */}
        {step === 1 && (
          <div className="mt-6 grid gap-4 max-w-[560px]">
            <h2 className="font-display font-extrabold italic uppercase text-[26px] text-brand-ink">Dados do grupo</h2>
            <div>
              <label className="label">Nome do grupo / assessoria</label>
              <input className="input" value={nomeGrupo} onChange={e => setNomeGrupo(e.target.value)}
                placeholder="Ex: Assessoria Corre Mais" />
            </div>
            <div>
              <label className="label">Responsável</label>
              <input className="input" value={respNome} onChange={e => setRespNome(e.target.value)}
                placeholder="Nome do responsável" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">E-mail do responsável</label>
                <input type="email" className="input" value={respEmail} onChange={e => setRespEmail(e.target.value)}
                  placeholder="voce@email.com" />
              </div>
              <div>
                <label className="label">Telefone / WhatsApp</label>
                <input className="input" value={respTel} onChange={e => setRespTel(e.target.value)}
                  placeholder="(31) 90000-0000" />
              </div>
            </div>
            <label className="flex items-start gap-3 text-[13px] text-brand-muted cursor-pointer mt-2">
              <input type="checkbox" checked={termo} onChange={e => setTermo(e.target.checked)}
                className="mt-0.5 accent-brand-purple w-4 h-4" />
              <span>
                Declaro que todos os atletas listados estão cientes e aptos a participar, e aceito o{' '}
                <span className="text-brand-purple underline">termo de responsabilidade</span>.
              </span>
            </label>
          </div>
        )}

        {/* ── STEP 2: Atletas ── */}
        {step === 2 && (
          <div className="mt-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="font-display font-extrabold italic uppercase text-[26px] text-brand-ink">
                Atletas <span className="text-brand-purple">({atletas.length})</span>
              </h2>
              <div className="text-[13px] text-brand-muted">
                Mínimo {MIN_GRUPO} · {resumo.atinge_minimo
                  ? <span className="text-green-600 font-semibold">✓ mínimo atingido</span>
                  : <span className="text-orange-500 font-semibold">faltam {MIN_GRUPO - atletas.length}</span>}
              </div>
            </div>

            {temDuplicado && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-[13px] text-red-600">
                Há CPFs repetidos na lista. Cada atleta deve ter um CPF único.
              </div>
            )}

            <div className="mt-4 space-y-3">
              {atletas.map((a, i) => {
                const mod = a.race_id ? modalidadeDe(a.race_id) : 'corrida';
                const camisetas = tamanhosDisponiveis(mod, a.camiseta_modelo);
                const err = erroAtleta(a);
                const cpfDup = a.cpf && cpfsLimpos.indexOf(a.cpf.replace(/\D/g, '')) !== i;
                return (
                  <div key={i} className={`card p-4 ${err && (a.nome || a.cpf) ? 'border-orange-200' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[12px] font-bold text-brand-muted">Atleta {i + 1}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[12px] text-brand-purple font-semibold">{categoriaDe(a)}</span>
                        {atletas.length > MIN_GRUPO && (
                          <button onClick={() => removeAtleta(i)} className="text-red-400 hover:text-red-600 text-[13px]">🗑</button>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-2 md:grid-cols-12">
                      <input className="input md:col-span-4" placeholder="Nome completo"
                        value={a.nome} onChange={e => setAtleta(i, { nome: e.target.value })} />
                      <input className={`input md:col-span-3 ${(a.cpf && !validaCPF(a.cpf)) || cpfDup ? 'border-red-400' : ''}`}
                        placeholder="CPF" maxLength={14} value={a.cpf}
                        onChange={e => setAtleta(i, { cpf: formataCPF(e.target.value.replace(/\D/g, '')) })} />
                      <input type="date" className="input md:col-span-3" value={a.nasc}
                        onChange={e => setAtleta(i, { nasc: e.target.value })} />
                      <div className="md:col-span-2 flex gap-1">
                        {(['M', 'F'] as const).map(sx => (
                          <button key={sx} onClick={() => setAtleta(i, { sexo: sx })}
                            className={`flex-1 py-2 rounded-lg text-[13px] font-semibold border-2 transition-colors
                              ${a.sexo === sx ? 'bg-brand-purple text-white border-brand-purple' : 'bg-white border-brand-lilac-mid'}`}>
                            {sx}
                          </button>
                        ))}
                      </div>
                      <select className="input md:col-span-4" value={a.race_id}
                        onChange={e => setAtleta(i, { race_id: e.target.value, camiseta: '' })}>
                        <option value="">Prova...</option>
                        {racesGrupo.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                      </select>
                      <select className="input md:col-span-3" value={a.camiseta_modelo}
                        onChange={e => {
                          const novoModelo = e.target.value as 'unissex' | 'babylook';
                          const validos = tamanhosDisponiveis(mod, novoModelo);
                          setAtleta(i, {
                            camiseta_modelo: novoModelo,
                            camiseta: validos.includes(a.camiseta) ? a.camiseta : '',
                          });
                        }}>
                        <option value="unissex">👕 Unissex</option>
                        <option value="babylook">👚 Baby Look</option>
                      </select>
                      <select className="input md:col-span-2" value={a.camiseta}
                        onChange={e => setAtleta(i, { camiseta: e.target.value })}>
                        <option value="">Tam...</option>
                        {camisetas.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input type="email" className="input md:col-span-3" placeholder="E-mail (opcional)"
                        value={a.email} onChange={e => setAtleta(i, { email: e.target.value })} />
                    </div>
                    {err && (a.nome || a.cpf) && (
                      <div className="text-[12px] text-orange-500 mt-1.5">Pendente: {err}</div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-4 flex-wrap">
              <button onClick={addAtleta} className="btn-outline text-[14px] py-2.5 px-5">+ Adicionar atleta</button>
              <button type="button" onClick={() => setVerTabela(true)}
                className="text-[13px] text-brand-purple font-semibold underline hover:text-brand-purple-dark">
                📏 Ver tabela de medidas
              </button>
            </div>

            {/* Resumo */}
            <div className="mt-6 card p-5 bg-brand-lilac/40">
              <div className="flex justify-between text-[13px]"><span className="text-brand-muted">Inscrições ({resumo.qtd} × {formataBRL(8900)})</span><span className="font-medium">{formataBRL(resumo.subtotal_inscricoes_centavos)}</span></div>
              <div className="flex justify-between text-[13px] mt-1"><span className="text-brand-muted">Taxa INO RUN ({resumo.qtd} × {formataBRL(500)})</span><span className="font-medium">{formataBRL(resumo.subtotal_taxas_centavos)}</span></div>
              <div className="flex items-baseline justify-between border-t border-brand-lilac-mid pt-2 mt-2">
                <span className="text-brand-muted text-[14px]">Total do grupo</span>
                <span className="font-display font-extrabold text-[32px] text-brand-purple">{formataBRL(resumo.total_centavos)}</span>
              </div>
            </div>

            {erro && <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[14px] text-red-700">❌ {erro}</div>}
          </div>
        )}

        {/* ── STEP 3: Pagamento Pix consolidado ── */}
        {step === 3 && groupId && (
          <div className="mt-6 max-w-[560px] space-y-5">
            <h2 className="font-display font-extrabold italic uppercase text-[26px] text-brand-ink">Pagamento do grupo</h2>

            <div className="bg-gradient-to-br from-brand-purple to-brand-purple-dark rounded-2xl p-6 text-white text-center shadow-lg">
              <div className="text-[12px] font-bold uppercase tracking-widest opacity-75 mb-1">Total a pagar via Pix</div>
              <div className="font-display font-extrabold text-[44px] leading-none">{formataBRL(totalCents)}</div>
              <div className="text-[12px] opacity-65 mt-2">{atletas.length} atletas · pagamento único</div>
            </div>

            <div className="bg-brand-lilac border border-brand-lilac-mid rounded-2xl p-5">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-muted mb-3">Chave Pix (CNPJ)</div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 bg-white border-2 border-brand-purple-mid rounded-xl px-4 py-3 font-mono text-[16px] font-bold text-brand-purple-dark tracking-wider select-all">{PIX_KEY_DISPLAY}</div>
                <button onClick={copiarChave}
                  className={`px-4 py-3 rounded-xl font-bold text-[13px] min-w-[90px] transition-all ${copiado ? 'bg-green-500 text-white' : 'bg-brand-purple text-white hover:bg-brand-purple-dark'}`}>
                  {copiado ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <div className="text-[12px] text-brand-muted">Beneficiária: <strong className="text-brand-ink">{PIX_NOME}</strong></div>
            </div>

            <div className="bg-white border border-brand-lilac-mid rounded-2xl p-5">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-muted mb-2">Comprovante do pagamento</div>
              <p className="text-[12px] text-brand-muted mb-3">Pague o valor total e envie o print. A equipe INO RUN confere e confirma o grupo (até 24h).</p>
              <div onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleArquivo(f); }}
                onDragOver={e => e.preventDefault()}
                onClick={() => document.getElementById('grupo-file')?.click()}
                className="border-2 border-dashed border-brand-lilac-mid rounded-2xl p-6 text-center cursor-pointer hover:border-brand-purple transition-colors">
                {preview
                  ? <img src={preview} alt="Comprovante" className="max-h-52 mx-auto rounded-xl object-contain" />
                  : <div className="text-brand-muted"><div className="text-4xl mb-2">📸</div><div className="text-[14px] font-semibold">Arraste ou clique para selecionar</div><div className="text-[11px] mt-1">JPG, PNG ou WEBP</div></div>}
              </div>
              <input id="grupo-file" type="file" className="hidden" accept="image/jpeg,image/png,image/webp"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleArquivo(f); }} />
            </div>

            {erro && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[14px] text-red-700">❌ {erro}</div>}

            <button onClick={handleEnviarComprovante} disabled={!arquivo || enviando}
              className="w-full py-4 rounded-2xl font-display font-extrabold italic uppercase text-[17px] bg-brand-purple text-white hover:bg-brand-purple-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md">
              {enviando ? 'Enviando...' : 'Enviar comprovante do grupo'}
            </button>
          </div>
        )}

        {/* ── STEP 4: Sucesso ── */}
        {step === 4 && sucesso && (
          <div className="mt-6 animate-fade-up max-w-[560px] mx-auto text-center">
            <div className="flex flex-col items-center py-6">
              <div className="w-24 h-24 rounded-full bg-amber-50 border-4 border-amber-300 flex items-center justify-center shadow-brand-lg mb-5">
                <span className="text-5xl">⏳</span>
              </div>
              <h2 className="font-display font-extrabold italic uppercase text-[30px] text-brand-ink leading-tight">Comprovante recebido!</h2>
              <p className="text-brand-muted mt-2 text-[14px]">O grupo <strong>{nomeGrupo}</strong> ({atletas.length} atletas) está em análise.</p>
            </div>
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 mb-4">
              <p className="text-[13px] text-amber-700">Confirmaremos o grupo em até <strong>24 horas</strong> após a verificação do comprovante. O responsável <strong>{respNome}</strong> receberá um aviso em <strong>{respEmail}</strong>.</p>
            </div>
            <button onClick={onDone} className="btn-primary w-full text-[18px] py-4">Voltar ao site</button>
          </div>
        )}

        {/* Navegação */}
        {step < 3 && (
          <button
            disabled={(step === 1 && !grupoValido) || (step === 2 && (!atletasValidos || temDuplicado)) || enviando}
            onClick={step === 1 ? () => setStep(2) : handleCriar}
            className={`w-full mt-7 py-4 rounded-xl font-display font-bold italic text-[18px] tracking-wider uppercase transition-all
              ${((step === 1 && grupoValido) || (step === 2 && atletasValidos && !temDuplicado)) && !enviando
                ? 'bg-brand-purple text-white hover:bg-brand-purple-dark active:scale-95 shadow-brand'
                : 'bg-brand-lilac-mid text-brand-muted cursor-not-allowed'}`}>
            {enviando ? 'Processando...' : step === 1 ? 'Continuar para atletas' : `Ir para pagamento · ${formataBRL(resumo.total_centavos)}`}
          </button>
        )}
      </div>

      {verTabela && <TabelaMedidasModal onClose={() => setVerTabela(false)} />}
    </div>
  );
}
