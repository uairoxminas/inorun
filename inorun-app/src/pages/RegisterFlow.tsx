// src/pages/RegisterFlow.tsx — Fluxo de inscrição real conectado ao Supabase
// 5 passos: prova → dados → categoria/kit → pagamento → confirmação
// v2: suporte a Kids (7-12), Caminhada e corrida com novas faixas etárias

import { useState, useMemo, useEffect } from 'react';
import Logo from '../components/Logo';
import { calcCategoria, validaIdadeModalidade } from '../lib/calcCategoria';
import type { Modalidade } from '../lib/calcCategoria';
import { validaCPF, formataCPF } from '../lib/validaCPF';
import { formataBRL } from '../lib/precoLoteAtual';
import { getEventoPublico, getLoteAtivo, validarCupom } from '../services/eventoService';
import { criarInscricaoCompleta } from '../services/inscricaoService';
import type { EventoData } from '../services/eventoService';
import type { ResultadoInscricao } from '../services/inscricaoService';

interface Props { onBack: () => void; onDone: () => void; }

const STEPS    = ['Prova', 'Seus dados', 'Categoria & kit', 'Pagamento', 'Confirmação'];
const CAMISETAS_ADULTO = ['PP', 'P', 'M', 'G', 'GG', 'XG'] as const;
const CAMISETAS_KIDS   = ['8', '10', '12', 'PP', 'P'] as const;   // tamanhos Kids

// Ícone e cor por modalidade
const MODALIDADE_CONFIG: Record<string, { emoji: string; cor: string; badge: string }> = {
  corrida:   { emoji: '🏃', cor: 'border-brand-purple-mid bg-brand-lilac', badge: 'Corrida' },
  kids:      { emoji: '🎖️', cor: 'border-yellow-400 bg-yellow-50',         badge: 'Kids — Todos ganham!' },
  caminhada: { emoji: '🚶', cor: 'border-green-400 bg-green-50',           badge: 'Caminhada' },
};

interface FormState {
  race_id: string;
  dist: '5km' | '10km' | '';
  modalidade: Modalidade | '';
  nome: string; cpf: string; nasc: string; sexo: 'M' | 'F' | '';
  email: string; tel: string; emergencia: string;
  camiseta: string; cupom: string; pag: 'pix' | 'cartao'; termo: boolean;
}

export default function RegisterFlow({ onBack, onDone }: Props) {
  const [step, setStep]         = useState(1);
  const [evento, setEvento]     = useState<EventoData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');
  const [resultado, setResultado] = useState<ResultadoInscricao | null>(null);
  const [cpfErro, setCpfErro]   = useState('');
  const [idadeErro, setIdadeErro] = useState('');
  const [cupomInfo, setCupomInfo] = useState<{ valido: boolean; desconto: number; id?: string } | null>(null);
  const [validandoCupom, setValidandoCupom] = useState(false);

  const [f, setF] = useState<FormState>({
    race_id: '', dist: '', modalidade: '',
    nome: '', cpf: '', nasc: '', sexo: '',
    email: '', tel: '', emergencia: '',
    camiseta: '', cupom: '', pag: 'pix', termo: false,
  });
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    getEventoPublico().then(setEvento).finally(() => setLoading(false));
  }, []);

  const race    = evento?.races.find(r => r.id === f.race_id);
  const loteAtual = (evento && f.race_id) ? getLoteAtivo(evento.lots, f.race_id) : null;
  const precoBase = loteAtual?.preco_centavos ?? 0;
  const desconto  = cupomInfo?.valido ? cupomInfo.desconto : 0;
  const total     = Math.round(precoBase * (1 - desconto));

  // Categoria calculada automaticamente
  const categoria = useMemo(() => {
    if (!f.nasc || !f.sexo || !f.modalidade) return '—';
    if (f.modalidade === 'caminhada') return 'Caminhada';
    if (f.modalidade === 'kids') return 'Kids Geral';
    return calcCategoria(new Date(f.nasc), f.sexo as 'M' | 'F', 'corrida');
  }, [f.nasc, f.sexo, f.modalidade]);

  // Valida idade ao mudar nascimento
  const handleNascChange = (valor: string) => {
    set('nasc', valor);
    setIdadeErro('');
    if (!valor || !f.modalidade) return;
    const val = validaIdadeModalidade(new Date(valor), f.modalidade as Modalidade);
    if (!val.valido) setIdadeErro(val.motivo ?? 'Idade inválida para esta modalidade.');
  };

  // Re-valida ao trocar modalidade
  const handleRaceSelect = (raceId: string) => {
    const r = evento?.races.find(x => x.id === raceId);
    if (!r) return;
    set('race_id', raceId);
    set('dist', r.distancia_km === 5 ? '5km' : '10km');
    set('modalidade', r.tipo as Modalidade);
    setIdadeErro('');
    // Re-valida se já tem nascimento
    if (f.nasc && r.tipo) {
      const val = validaIdadeModalidade(new Date(f.nasc), r.tipo as Modalidade);
      if (!val.valido) setIdadeErro(val.motivo ?? '');
    }
  };

  // Validação por step
  // Sexo: obrigatório para corrida (derive categoria), opcional para Kids/Caminhada
  const sexoObrigatorio = f.modalidade === 'corrida';
  const canAdvance: Record<number, boolean> = {
    1: !!f.race_id && !!loteAtual,
    2: !!f.nome && !!f.cpf && !!f.nasc && !!f.email && !cpfErro && !idadeErro &&
       (!sexoObrigatorio || !!f.sexo),   // sexo só bloqueia na corrida
    3: !!f.camiseta,
    4: f.termo,
  };

  const handleCpfBlur = () => {
    if (f.cpf && !validaCPF(f.cpf)) setCpfErro('CPF inválido');
    else setCpfErro('');
  };

  const handleValidarCupom = async () => {
    if (!f.cupom.trim()) return;
    setValidandoCupom(true);
    const res = await validarCupom(f.cupom);
    setCupomInfo(res);
    setValidandoCupom(false);
  };

  // Submete a inscrição no Supabase
  const handlePagar = async () => {
    if (!evento || !race || !loteAtual) return;
    setEnviando(true);
    setErroEnvio('');
    try {
      const res = await criarInscricaoCompleta(
        {
          nome: f.nome, cpf: f.cpf, nascimento: f.nasc,
          sexo: f.sexo ? (f.sexo as 'M' | 'F') : undefined, // opcional para Kids/Caminhada
          email: f.email,
          telefone: f.tel, contato_emergencia: f.emergencia,
        },
        {
          race_id:          f.race_id,
          lot_id:           loteAtual.id,
          event_id:         evento.id,
          modalidade:       f.modalidade as Modalidade,
          camiseta:         f.camiseta as 'PP' | 'P' | 'M' | 'G' | 'GG' | 'XG',
          cupom_id:         cupomInfo?.id,
          valor_centavos:   total,
          metodo_pagamento: f.pag,
        },
        { label: race.label }
      );
      setResultado(res);
      setStep(5);
    } catch (err: unknown) {
      setErroEnvio(err instanceof Error ? err.message : 'Erro inesperado. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <div className="text-brand-muted text-[15px] animate-pulse">Carregando evento...</div>
    </div>
  );

  // Agrupa races por tipo para exibição no Step 1
  const racesCorreida   = evento?.races.filter(r => r.tipo === 'corrida') ?? [];
  const raceKids        = evento?.races.find(r => r.tipo === 'kids');
  const raceCaminhada   = evento?.races.find(r => r.tipo === 'caminhada');

  const modConf = f.modalidade ? MODALIDADE_CONFIG[f.modalidade] : null;

  return (
    <div className="bg-brand-bg text-brand-ink font-sans min-h-screen">
      <div className="mx-auto px-5 py-6 max-w-[560px]">

        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={step === 1 ? onBack : () => setStep(s => s - 1)} className="btn-ghost">
            ← {step === 1 ? 'Voltar ao site' : 'Voltar'}
          </button>
          <Logo height={28} />
        </div>

        {/* Info box */}
        <div className="mt-5 bg-brand-lilac border border-brand-lilac-mid rounded-xl px-4 py-3 text-[13px] text-brand-purple-dark">
          <strong>Inscrição INO RUN 2026.</strong> Categoria calculada automaticamente pela idade em 11/10/2026.
          CPF único por prova. Pagamento via Pix ou cartão.
        </div>

        {/* Progress */}
        <div className="mt-4 flex gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className={`flex-1 h-1 rounded-full transition-all duration-300 ${i < step ? 'bg-brand-purple' : 'bg-brand-lilac-mid'}`} />
          ))}
        </div>
        <div className="font-display italic tracking-[0.1em] text-[13px] text-brand-purple mt-2 uppercase">
          Passo {step} de 5 · {STEPS[step - 1]}
        </div>

        {/* ── STEP 1: Escolha a prova ── */}
        {step === 1 && (
          <div className="mt-6 grid gap-5">

            {/* Corridas */}
            <div>
              <div className="text-[12px] font-semibold text-brand-muted uppercase tracking-widest mb-2">🏃 Corridas</div>
              <div className="grid gap-3">
                {racesCorreida.map(r => {
                  const lote = getLoteAtivo(evento!.lots, r.id);
                  const sel  = f.race_id === r.id;
                  return (
                    <button key={r.id} id={`select-prova-${r.distancia_km}km`}
                      onClick={() => handleRaceSelect(r.id)}
                      className={`flex items-center justify-between text-left p-5 rounded-2xl border-2 transition-all duration-150
                        ${sel ? 'bg-brand-lilac border-brand-purple-mid shadow-brand' : 'bg-white border-brand-lilac-mid hover:border-brand-purple-mid'}`}>
                      <div>
                        <div className="font-display font-extrabold italic text-[26px] uppercase text-brand-ink">{r.label}</div>
                        <div className="text-[13px] text-brand-muted">{r.distancia_km === 5 ? 'Iniciante · Premiação geral + faixas' : 'Performance · Premiação geral + faixas'}</div>
                        {!lote && <div className="text-[12px] text-orange-500 mt-1">Inscrições encerradas</div>}
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-brand-muted">a partir de</div>
                        <div className="font-display font-extrabold text-[24px] text-brand-purple">
                          {lote ? formataBRL(lote.preco_centavos) : '—'}
                        </div>
                        {lote && <div className="text-[11px] text-brand-muted">{lote.nome}</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Kids */}
            {raceKids && (() => {
              const lote = getLoteAtivo(evento!.lots, raceKids.id);
              const sel  = f.race_id === raceKids.id;
              return (
                <div>
                  <div className="text-[12px] font-semibold text-brand-muted uppercase tracking-widest mb-2">🎖️ Kids (7-12 anos)</div>
                  <button id="select-prova-kids"
                    onClick={() => handleRaceSelect(raceKids.id)}
                    className={`w-full flex items-center justify-between text-left p-5 rounded-2xl border-2 transition-all duration-150
                      ${sel ? 'bg-yellow-50 border-yellow-400 shadow-md' : 'bg-white border-yellow-200 hover:border-yellow-400'}`}>
                    <div>
                      <div className="font-display font-extrabold italic text-[22px] uppercase text-brand-ink">{raceKids.label}</div>
                      <div className="text-[13px] text-brand-muted">7 a 12 anos · Todos ganham medalha e sobem ao pódio!</div>
                      <div className="mt-1 inline-block bg-yellow-400 text-yellow-900 text-[11px] font-bold px-2 py-0.5 rounded-full">
                        🏅 Todos os participantes são campeões
                      </div>
                      {!lote && <div className="text-[12px] text-orange-500 mt-1">Inscrições encerradas</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-brand-muted">a partir de</div>
                      <div className="font-display font-extrabold text-[20px] text-brand-purple">
                        {lote ? formataBRL(lote.preco_centavos) : '—'}
                      </div>
                      {lote && <div className="text-[11px] text-brand-muted">{lote.nome}</div>}
                    </div>
                  </button>
                </div>
              );
            })()}

            {/* Caminhada */}
            {raceCaminhada && (() => {
              const lote = getLoteAtivo(evento!.lots, raceCaminhada.id);
              const sel  = f.race_id === raceCaminhada.id;
              return (
                <div>
                  <div className="text-[12px] font-semibold text-brand-muted uppercase tracking-widest mb-2">🚶 Caminhada</div>
                  <button id="select-prova-caminhada"
                    onClick={() => handleRaceSelect(raceCaminhada.id)}
                    className={`w-full flex items-center justify-between text-left p-5 rounded-2xl border-2 transition-all duration-150
                      ${sel ? 'bg-green-50 border-green-400 shadow-md' : 'bg-white border-green-200 hover:border-green-400'}`}>
                    <div>
                      <div className="font-display font-extrabold italic text-[22px] uppercase text-brand-ink">{raceCaminhada.label}</div>
                      <div className="text-[13px] text-brand-muted">Qualquer idade · Sem cronometragem competitiva · Certificado de conclusão</div>
                      {!lote && <div className="text-[12px] text-orange-500 mt-1">Inscrições encerradas</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-brand-muted">a partir de</div>
                      <div className="font-display font-extrabold text-[20px] text-brand-purple">
                        {lote ? formataBRL(lote.preco_centavos) : '—'}
                      </div>
                      {lote && <div className="text-[11px] text-brand-muted">{lote.nome}</div>}
                    </div>
                  </button>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── STEP 2: Dados pessoais ── */}
        {step === 2 && (
          <div className="mt-6 grid gap-4">
            {/* Alerta Kids */}
            {f.modalidade === 'kids' && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-3 text-[13px] text-yellow-800">
                <strong>🎖️ Inscrição Kids (7-12 anos)</strong><br />
                Preencha os dados da criança. Use o campo "Contato de emergência" para informar o responsável legal (nome e telefone).
                A categoria Kids é automaticamente "Kids Geral" — todos ganham medalha!
              </div>
            )}
            {/* Alerta Caminhada */}
            {f.modalidade === 'caminhada' && (
              <div className="bg-green-50 border border-green-300 rounded-xl px-4 py-3 text-[13px] text-green-800">
                <strong>🚶 Caminhada 5 km</strong><br />
                Modalidade sem cronometragem competitiva. Você receberá certificado de conclusão ao final.
              </div>
            )}

            <div>
              <label className="label">Nome completo</label>
              <input id="input-nome" className="input" value={f.nome}
                onChange={e => set('nome', e.target.value)} placeholder="Como no documento" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">CPF</label>
                <input id="input-cpf"
                  className={`input ${cpfErro ? 'border-red-400 focus:ring-red-400' : ''}`}
                  value={f.cpf}
                  onChange={e => set('cpf', formataCPF(e.target.value.replace(/\D/g, '')))}
                  onBlur={handleCpfBlur}
                  placeholder="000.000.000-00" maxLength={14} />
                {cpfErro && <p className="text-red-500 text-[12px] mt-1">{cpfErro}</p>}
              </div>
              <div>
                <label className="label">
                  Data de Nascimento
                  {f.modalidade === 'kids' && <span className="text-yellow-600 ml-1">(7-12 anos)</span>}
                  {f.modalidade === 'corrida' && <span className="text-brand-muted ml-1">(mín. 13 anos)</span>}
                </label>
                <input id="input-nasc" type="date" className={`input ${idadeErro ? 'border-red-400 focus:ring-red-400' : ''}`}
                  value={f.nasc}
                  onChange={e => handleNascChange(e.target.value)} />
                {idadeErro && <p className="text-red-500 text-[12px] mt-1">{idadeErro}</p>}
              </div>
            </div>
            <div>
              <label className="label">
                Sexo
                {f.modalidade === 'corrida' ? ' (para categoria)' : ' (para o kit — opcional)'}
              </label>
              <div className="flex gap-3">
                {(['M', 'F'] as const).map(sx => (
                  <button key={sx} id={`select-sexo-${sx}`}
                    onClick={() => set('sexo', sx)}
                    className={`flex-1 py-3 rounded-xl font-semibold border-2 transition-all duration-150
                      ${f.sexo === sx ? 'bg-brand-purple text-white border-brand-purple' : 'bg-white text-brand-ink border-brand-lilac-mid hover:border-brand-purple'}`}>
                    {sx === 'M' ? 'Masculino' : 'Feminino'}
                  </button>
                ))}
              </div>
              {!sexoObrigatorio && !f.sexo && (
                <p className="text-[12px] text-brand-muted mt-1">Pode pular se preferir</p>
              )}
            </div>
            <div>
              <label className="label">E-mail</label>
              <input id="input-email" type="email" className="input" value={f.email}
                onChange={e => set('email', e.target.value)} placeholder="voce@email.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Telefone</label>
                <input id="input-tel" className="input" value={f.tel}
                  onChange={e => set('tel', e.target.value)} placeholder="(31) 90000-0000" />
              </div>
              <div>
                <label className="label">
                  {f.modalidade === 'kids' ? 'Responsável legal (nome e tel.)' : 'Contato de emergência'}
                </label>
                <input id="input-emergencia" className="input" value={f.emergencia}
                  onChange={e => set('emergencia', e.target.value)} placeholder="Nome e telefone" />
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Categoria + kit + cupom ── */}
        {step === 3 && (
          <div className="mt-6 grid gap-5">
            {/* Exibição da categoria */}
            {f.modalidade === 'kids' ? (
              <div className="bg-yellow-50 border border-yellow-400 rounded-2xl p-5">
                <div className="text-[13px] text-yellow-700">Categoria especial</div>
                <div className="font-display font-extrabold italic text-[32px] text-yellow-600 mt-1">🎖️ Kids Geral</div>
                <div className="text-[12px] text-yellow-700 mt-0.5 font-medium">
                  Todos os participantes de 7 a 12 anos ganham medalha e sobem ao pódio!
                </div>
              </div>
            ) : f.modalidade === 'caminhada' ? (
              <div className="bg-green-50 border border-green-400 rounded-2xl p-5">
                <div className="text-[13px] text-green-700">Modalidade</div>
                <div className="font-display font-extrabold italic text-[32px] text-green-600 mt-1">🚶 Caminhada</div>
                <div className="text-[12px] text-green-700 mt-0.5">
                  Sem cronometragem competitiva · Certificado de conclusão
                </div>
              </div>
            ) : (
              <div className="bg-white border border-brand-lilac-mid rounded-2xl p-5">
                <div className="text-[13px] text-brand-muted">Sua categoria (calculada pela idade em 11/10/2026)</div>
                <div className="font-display font-extrabold italic text-[32px] text-brand-purple mt-1">{categoria}</div>
                <div className="text-[12px] text-brand-muted mt-0.5">
                  Premiação: 1º ao 3º lugar por faixa · {f.sexo === 'M' ? 'Masculino' : 'Feminino'}
                </div>
              </div>
            )}

            <div>
              <label className="label">Tamanho da camiseta</label>
              {f.modalidade === 'kids' && (
                <p className="text-[12px] text-brand-muted mb-2">Tamanhos infantis (8, 10, 12) + adulto pequeno (PP, P)</p>
              )}
              <div className="flex flex-wrap gap-2">
                {(f.modalidade === 'kids' ? CAMISETAS_KIDS : CAMISETAS_ADULTO).map(c => (
                  <button key={c} id={`select-camiseta-${c}`}
                    onClick={() => set('camiseta', c)}
                    className={`w-14 py-3 rounded-xl font-display font-bold text-[16px] border-2 transition-all duration-150
                      ${f.camiseta === c ? 'bg-brand-purple text-white border-brand-purple' : 'bg-white text-brand-ink border-brand-lilac-mid hover:border-brand-purple'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Cupom de desconto (opcional)</label>
              <div className="flex gap-2">
                <input id="input-cupom" className="input" value={f.cupom}
                  onChange={e => { set('cupom', e.target.value.toUpperCase()); setCupomInfo(null); }}
                  placeholder="Ex: INO10" />
                <button onClick={handleValidarCupom} disabled={validandoCupom || !f.cupom.trim()}
                  className="btn-outline text-sm px-4 py-2 whitespace-nowrap">
                  {validandoCupom ? '...' : 'Aplicar'}
                </button>
              </div>
              {cupomInfo?.valido && (
                <div className="text-brand-purple text-[13px] mt-1.5 font-semibold">
                  ✓ Cupom aplicado: {Math.round(cupomInfo.desconto * 100)}% de desconto
                </div>
              )}
              {cupomInfo && !cupomInfo.valido && (
                <div className="text-red-500 text-[13px] mt-1.5">Cupom inválido ou expirado</div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 4: Pagamento ── */}
        {step === 4 && (
          <div className="mt-6 grid gap-5">
            <div className={`rounded-2xl p-5 border-2 ${modConf ? modConf.cor : 'bg-white border-brand-lilac-mid'}`}>
              <div className="text-[14px] text-brand-muted">
                {race?.label} · {categoria} · Camiseta {f.camiseta}
              </div>
              {loteAtual && <div className="text-[12px] text-brand-muted mt-0.5">{loteAtual.nome}</div>}
              {desconto > 0 && (
                <div className="flex justify-between mt-2 text-[13px]">
                  <span className="text-brand-muted">Desconto ({Math.round(desconto * 100)}%)</span>
                  <span className="text-green-600 font-medium">−{formataBRL(precoBase * desconto)}</span>
                </div>
              )}
              <div className="mt-3 flex items-baseline justify-between border-t border-brand-lilac-mid pt-3">
                <span className="text-brand-muted text-[14px]">Total</span>
                <span className="font-display font-extrabold text-[36px] text-brand-purple">{formataBRL(total)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {([['pix', 'Pix', 'Confirmação imediata'], ['cartao', 'Cartão', 'Em até 12x']] as const).map(([id, titulo, sub]) => (
                <button key={id} id={`select-pag-${id}`}
                  onClick={() => set('pag', id)}
                  className={`text-left p-4 rounded-xl border-2 transition-all duration-150
                    ${f.pag === id ? 'bg-brand-lilac border-brand-purple-mid' : 'bg-white border-brand-lilac-mid hover:border-brand-purple-mid'}`}>
                  <div className="font-bold text-brand-ink">{titulo}</div>
                  <div className="text-[12px] text-brand-muted mt-0.5">{sub}</div>
                </button>
              ))}
            </div>

            <label className="flex items-start gap-3 text-[13px] text-brand-muted cursor-pointer">
              <input id="check-termo" type="checkbox" checked={f.termo}
                onChange={e => set('termo', e.target.checked)}
                className="mt-0.5 accent-brand-purple w-4 h-4" />
              <span>
                Li e aceito o <span className="text-brand-purple underline">termo de responsabilidade</span>{' '}
                e declaro estar apto(a) a participar da prova.
                {f.modalidade === 'kids' && ' (Responsável legal autoriza a participação da criança.)'}
              </span>
            </label>

            {erroEnvio && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[14px] text-red-700">
                ❌ {erroEnvio}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 5: Confirmação real do Supabase ── */}
        {step === 5 && resultado && (
          <div className="mt-6 text-center py-5 animate-fade-up">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto text-3xl font-bold shadow-brand-lg
              ${f.modalidade === 'kids' ? 'bg-yellow-400 text-yellow-900' : f.modalidade === 'caminhada' ? 'bg-green-500 text-white' : 'bg-brand-purple text-white'}`}>
              {f.modalidade === 'kids' ? '🎖️' : f.modalidade === 'caminhada' ? '🚶' : '✓'}
            </div>
            <h2 className="font-display font-extrabold italic uppercase text-[36px] text-brand-ink mt-4 leading-tight">
              {f.modalidade === 'kids' ? 'Você é campeão(ã)!' : 'Inscrição confirmada!'}
            </h2>
            <p className="text-brand-muted mt-2">
              {resultado.atleta_nome}, sua vaga na {resultado.prova_label} está garantida.
            </p>
            {f.modalidade === 'kids' && (
              <p className="text-yellow-600 font-semibold mt-1">
                🏅 Todos os Kids ganham medalha e sobem ao pódio!
              </p>
            )}

            <div className="bg-white border border-brand-lilac-mid rounded-2xl p-6 mt-6 shadow-brand">
              <div className="text-[12px] text-brand-muted tracking-[0.15em] uppercase">Seu número de peito</div>
              <div className="font-display font-extrabold italic text-[80px] text-brand-purple leading-none my-2">
                {resultado.bib_number}
              </div>
              <div className="text-[13px] text-brand-muted mb-1">{resultado.categoria} · {resultado.prova_label}</div>
              <div className="text-[13px] text-brand-muted mb-4">{formataBRL(resultado.valor_centavos)} via {resultado.metodo === 'pix' ? 'Pix' : 'Cartão'}</div>

              {/* QR simulado */}
              <div className="w-24 h-24 mx-auto rounded-lg overflow-hidden border-4 border-brand-ink"
                style={{ background: 'repeating-conic-gradient(#26122E 0% 25%, #fff 0% 50%)', backgroundSize: '16px 16px' }} />
              <div className="text-[12px] text-brand-muted mt-2">QR de check-in · enviado ao e-mail</div>
            </div>

            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-[13px] text-green-700">
              ✅ Inscrição salva no banco de dados · ID: {resultado.registration_id.slice(0, 8)}...
            </div>

            <button id="btn-voltar-site" onClick={onDone} className="btn-primary mt-6 text-[18px] px-8 py-4">
              Voltar ao site
            </button>
          </div>
        )}

        {/* Botão avançar / pagar */}
        {step < 5 && (
          <button id={`btn-step-${step}-avancar`}
            disabled={!canAdvance[step] || enviando}
            onClick={step === 4 ? handlePagar : () => setStep(s => s + 1)}
            className={`w-full mt-7 py-4 rounded-xl font-display font-bold italic text-[18px] tracking-wider uppercase transition-all duration-150
              ${canAdvance[step] && !enviando
                ? 'bg-brand-purple text-white hover:bg-brand-purple-dark active:scale-95 shadow-brand'
                : 'bg-brand-lilac-mid text-brand-muted cursor-not-allowed'}`}>
            {enviando ? 'Processando...' : step === 4 ? `Pagar ${formataBRL(total)}` : 'Continuar'}
          </button>
        )}
      </div>
    </div>
  );
}
