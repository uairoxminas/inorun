// src/pages/RegisterFlow.tsx — Fluxo de inscrição real conectado ao Supabase
// 5 passos: prova → dados → categoria/kit → pagamento → confirmação
// v2: suporte a Kids (7-12 anos · 300m), Caminhada (todos ganham medalha) e corrida com novas faixas etárias

import { useState, useMemo, useEffect } from 'react';
import Logo from '../components/Logo';
import { calcCategoria, validaIdadeModalidade } from '../lib/calcCategoria';
import type { Modalidade } from '../lib/calcCategoria';
import { validaCPF, formataCPF } from '../lib/validaCPF';
import { formataBRL } from '../lib/precoLoteAtual';
import { tamanhosDisponiveis } from '../lib/camisetas';
import { getEventoPublico, getLoteAtivo, validarCupom } from '../services/eventoService';
import { criarInscricaoPendente } from '../services/inscricaoService';
import type { EventoData } from '../services/eventoService';
import type { ResultadoInscricao, InscricaoPendente } from '../services/inscricaoService';
import PixPaymentScreen from '../components/PixPaymentScreen';
import TabelaMedidasModal from '../components/TabelaMedidasModal';

interface Props { onBack: () => void; onDone: () => void; }

const STEPS    = ['Prova', 'Seus dados', 'Categoria & kit', 'Pagamento', 'Confirmação'];

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
  camiseta: string; camiseta_modelo: 'unissex' | 'babylook';
  cupom: string; pag: 'pix'; termo: boolean;
}

export default function RegisterFlow({ onBack, onDone }: Props) {
  const [step, setStep]         = useState(1);
  const [evento, setEvento]     = useState<EventoData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');
  const [resultado, setResultado]   = useState<ResultadoInscricao | null>(null);
  const [pixPendente, setPixPendente] = useState<InscricaoPendente | null>(null);
  const [emAnalise, setEmAnalise]   = useState(false);
  const [cpfErro, setCpfErro]       = useState('');
  const [idadeErro, setIdadeErro] = useState('');
  const [cupomInfo, setCupomInfo] = useState<{ valido: boolean; desconto: number; id?: string } | null>(null);
  const [validandoCupom, setValidandoCupom] = useState(false);

  const [f, setF] = useState<FormState>({
    race_id: '', dist: '', modalidade: '',
    nome: '', cpf: '', nasc: '', sexo: '',
    email: '', tel: '', emergencia: '',
    camiseta: '', camiseta_modelo: 'unissex', cupom: '', pag: 'pix', termo: false,
  });
  const [verTabela, setVerTabela] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    getEventoPublico().then(setEvento).finally(() => setLoading(false));
  }, []);

  const race    = evento?.races.find(r => r.id === f.race_id);
  const loteAtual = (evento && f.race_id) ? getLoteAtivo(evento.lots, f.race_id) : null;
  const precoBase = loteAtual?.preco_centavos ?? 0;
  const desconto  = cupomInfo?.valido ? cupomInfo.desconto : 0;
  // Opção B: valor líquido da inscrição separado da taxa de plataforma
  const TAXA_PLATAFORMA = 500;                                // R$5,00 fixo
  const valorInscricao  = Math.round(precoBase * (1 - desconto)); // pós-cupom, sem taxa
  const total           = valorInscricao + TAXA_PLATAFORMA;   // total cobrado do atleta

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
    // Resiliência: se tipo não estiver preenchido no banco, é uma corrida
    const tipoEfetivo: Modalidade = (r.tipo as Modalidade) || 'corrida';
    set('race_id', raceId);
    set('dist', r.distancia_km === 5 ? '5km' : '10km');
    set('modalidade', tipoEfetivo);
    setIdadeErro('');
    // Re-valida se já tem nascimento
    if (f.nasc) {
      const val = validaIdadeModalidade(new Date(f.nasc), tipoEfetivo);
      if (!val.valido) setIdadeErro(val.motivo ?? '');
    }
  };

  // Validação por step
  // Sexo: obrigatório para corrida (derive categoria), opcional para Kids/Caminhada
  const sexoObrigatorio = f.modalidade === 'corrida';
  const canAdvance: Record<number, boolean> = {
    1: !!f.race_id && !!loteAtual,
    2: !!f.nome && !!f.cpf && !!f.nasc && !!f.email && !!f.tel && !!f.emergencia &&
       !cpfErro && !idadeErro &&
       (!sexoObrigatorio || !!f.sexo),
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
      const pendente = await criarInscricaoPendente(
        {
          nome: f.nome, cpf: f.cpf, nascimento: f.nasc,
          sexo: f.sexo ? (f.sexo as 'M' | 'F') : undefined,
          email: f.email,
          telefone: f.tel, contato_emergencia: f.emergencia,
        },
        {
          race_id:                  f.race_id,
          lot_id:                   loteAtual.id,
          event_id:                 evento.id,
          modalidade:               f.modalidade as Modalidade,
          camiseta:                 f.camiseta as 'PP' | 'P' | 'M' | 'G' | 'GG' | 'XG' | 'XGG' | '4' | '6' | '8' | '10' | '12' | '14',
          camiseta_modelo:          f.camiseta_modelo,
          cupom_id:                 cupomInfo?.id,
          valor_centavos:           valorInscricao,
          taxa_plataforma_centavos: TAXA_PLATAFORMA,
          metodo_pagamento:         'pix',
        },
        { label: race.label }
      );
      setPixPendente(pendente);
      setStep(4.5 as unknown as number); // tela intermediaria Pix
    } catch (err: unknown) {
      setErroEnvio(err instanceof Error ? err.message : 'Erro inesperado. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const handlePixConfirmado = (res: ResultadoInscricao) => {
    setResultado(res);
    setPixPendente(null);
    setStep(5);
  };

  const handleEmAnalise = () => {
    setPixPendente(null);
    setEmAnalise(true);
    setStep(5);
  };

  if (loading) return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <div className="text-brand-muted text-[15px] animate-pulse">Carregando evento...</div>
    </div>
  );

  // Agrupa races por tipo para exibição no Step 1
  // Resiliência: se tipo = null (migration 013 ainda não rodada), trata corridas pelo distancia_km
  const racesCorreida = evento?.races.filter(r =>
    r.tipo === 'corrida' || ((!r.tipo || r.tipo === null) && r.distancia_km > 0)
  ) ?? [];
  const raceKids      = evento?.races.find(r => r.tipo === 'kids');
  const raceCaminhada = evento?.races.find(r => r.tipo === 'caminhada');

  const modConf = f.modalidade ? MODALIDADE_CONFIG[f.modalidade] : null;

  return (
    <div className="bg-brand-bg text-brand-ink font-sans min-h-screen">
      <div className="mx-auto px-5 py-6 max-w-[560px]">

        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={pixPendente ? () => { setPixPendente(null); setStep(4); } : step === 1 ? onBack : () => setStep(s => s - 1)}
            className="btn-ghost">
            {pixPendente ? '← Cancelar Pix' : step === 1 ? '← Voltar ao site' : '← Voltar'}
          </button>
          <Logo height={28} />
        </div>

        {/* Info box */}
        <div className="mt-5 bg-brand-lilac border border-brand-lilac-mid rounded-xl px-4 py-3 text-[13px] text-brand-purple-dark">
          <strong>Inscrição INO RUN 2026.</strong> Categoria calculada automaticamente pela idade em 11/10/2026.
          CPF único por prova. Pagamento via Pix.
        </div>

        {/* Progress */}
        <div className="mt-4 flex gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className={`flex-1 h-1 rounded-full transition-all duration-300 ${i < step ? 'bg-brand-purple' : 'bg-brand-lilac-mid'}`} />
          ))}
        </div>
        <div className="font-display italic tracking-[0.1em] text-[13px] text-brand-purple mt-2 uppercase">
          {pixPendente ? 'Passo 4 de 5 · Pagamento Pix' : `Passo ${step} de 5 · ${STEPS[step - 1]}`}
        </div>

        {/* ── TELA PIX (step 4.5) ── */}
        {pixPendente && (
          <div className="mt-6">
            <div className="bg-brand-lilac border border-brand-lilac-mid rounded-2xl p-4 mb-5">
              <h3 className="font-display font-extrabold italic uppercase text-[15px] text-brand-purple-dark mb-1">
                Pague via Pix e confirme sua inscricao
              </h3>
              <p className="text-[12px] text-brand-muted">
                Realize o pagamento no seu banco, fotografe o comprovante e envie abaixo.
                Nossa IA verificara automaticamente.
              </p>
            </div>
            <PixPaymentScreen
              registration_id={pixPendente.registration_id}
              valor_total={pixPendente.valor_total}
              valor_inscricao={pixPendente.valor_total - 500}
              taxa={500}
              atleta_nome={pixPendente.atleta_nome}
              atleta_email={pixPendente.atleta_email}
              prova_label={pixPendente.prova_label}
              categoria={pixPendente.categoria}
              onConfirmado={handlePixConfirmado}
              onEmAnalise={handleEmAnalise}
            />
          </div>
        )}

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
                  <div className="text-[12px] font-semibold text-brand-muted uppercase tracking-widest mb-2">🎖️ Kids · 7-12 anos · 300m</div>
                  <button id="select-prova-kids"
                    onClick={() => handleRaceSelect(raceKids.id)}
                    className={`w-full flex items-center justify-between text-left p-5 rounded-2xl border-2 transition-all duration-150
                      ${sel ? 'bg-yellow-50 border-yellow-400 shadow-md' : 'bg-white border-yellow-200 hover:border-yellow-400'}`}>
                    <div>
                      <div className="font-display font-extrabold italic text-[22px] uppercase text-brand-ink">{raceKids.label}</div>
                      <div className="text-[13px] text-brand-muted">7 a 12 anos · 300 metros · Todos ganham medalha e sobem ao pódio!</div>
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
                      <div className="text-[13px] text-brand-muted">Qualquer idade · 5 km · Todos ganham medalha e sobem ao pódio!</div>
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
                <strong>🎖️ Inscrição Kids (7-12 anos · 300 metros)</strong><br />
                Preencha os dados da criança. Use o campo "Contato de emergência" para informar o responsável legal (nome e telefone).
                A categoria Kids é automaticamente "Kids Geral" — todos ganham medalha!
              </div>
            )}
            {/* Alerta Caminhada */}
            {f.modalidade === 'caminhada' && (
              <div className="bg-green-50 border border-green-300 rounded-xl px-4 py-3 text-[13px] text-green-800">
                <strong>🚶 Caminhada 5 km</strong><br />
                Modalidade de 5 km. Todos ganham medalha e sobem ao pódio — sem cronometragem competitiva.
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
                <label className="label">Telefone <span className="text-red-500">*</span></label>
                <input id="input-tel" className={`input ${!f.tel && f.nome ? 'border-red-300' : ''}`} value={f.tel}
                  onChange={e => set('tel', e.target.value)} placeholder="(31) 90000-0000" />
              </div>
              <div>
                <label className="label">
                  {f.modalidade === 'kids' ? 'Responsável legal (nome e tel.)' : 'Contato de emergência'} <span className="text-red-500">*</span>
                </label>
                <input id="input-emergencia" className={`input ${!f.emergencia && f.nome ? 'border-red-300' : ''}`} value={f.emergencia}
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
                  Todos os participantes de 7 a 12 anos ganham medalha e sobem ao pódio! (300 metros)
                </div>
              </div>
            ) : f.modalidade === 'caminhada' ? (
              <div className="bg-green-50 border border-green-400 rounded-2xl p-5">
                <div className="text-[13px] text-green-700">Modalidade</div>
                <div className="font-display font-extrabold italic text-[32px] text-green-600 mt-1">🚶 Caminhada</div>
                <div className="text-[12px] text-green-700 mt-0.5">
                  Todos os participantes ganham medalha e sobem ao pódio! Modalidade de 5 km.
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

            {/* Modelo da camiseta */}
            <div>
              <label className="label">Modelo da camiseta</label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { id: 'unissex',  emoji: '👕', nome: 'Unissex', det: 'Com manga' },
                  { id: 'babylook', emoji: '👚', nome: 'Baby Look', det: 'Modelagem feminina' },
                ] as const).map(m => (
                  <button key={m.id} id={`select-modelo-${m.id}`}
                    onClick={() => setF(p => {
                      const validos = tamanhosDisponiveis(p.modalidade, m.id);
                      return { ...p, camiseta_modelo: m.id, camiseta: validos.includes(p.camiseta) ? p.camiseta : '' };
                    })}
                    className={`text-left p-4 rounded-xl border-2 transition-all duration-150
                      ${f.camiseta_modelo === m.id ? 'bg-brand-purple text-white border-brand-purple' : 'bg-white text-brand-ink border-brand-lilac-mid hover:border-brand-purple'}`}>
                    <div className="text-[18px]">{m.emoji}</div>
                    <div className="font-display font-bold text-[16px] leading-tight mt-1">{m.nome}</div>
                    <div className={`text-[11px] ${f.camiseta_modelo === m.id ? 'text-white/80' : 'text-brand-muted'}`}>{m.det}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="label mb-0">Tamanho da camiseta</label>
                <button type="button" id="btn-ver-tabela-medidas" onClick={() => setVerTabela(true)}
                  className="text-[12px] text-brand-purple font-semibold underline hover:text-brand-purple-dark">
                  📏 Ver tabela de medidas
                </button>
              </div>
              {f.modalidade === 'kids' && (
                <p className="text-[12px] text-brand-muted mb-2 mt-1">Tamanhos infantis (8, 10, 12) + adulto pequeno (PP, P)</p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {tamanhosDisponiveis(f.modalidade, f.camiseta_modelo).map(c => (
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
                {race?.label} · {categoria} · Camiseta {f.camiseta} ({f.camiseta_modelo === 'babylook' ? 'Baby Look' : 'Unissex'})
              </div>
              {loteAtual && <div className="text-[12px] text-brand-muted mt-0.5">{loteAtual.nome}</div>}

              {/* Desconto de cupom */}
              {desconto > 0 && (
                <div className="flex justify-between mt-2 text-[13px]">
                  <span className="text-brand-muted">Desconto ({Math.round(desconto * 100)}%)</span>
                  <span className="text-green-600 font-medium">−{formataBRL(precoBase * desconto)}</span>
                </div>
              )}

              {/* Breakdown: inscrição + taxa de plataforma */}
              <div className="mt-3 pt-3 border-t border-brand-lilac-mid space-y-1.5">
                <div className="flex justify-between text-[13px]">
                  <span className="text-brand-muted">Inscrição</span>
                  <span className="text-brand-ink font-medium">{formataBRL(valorInscricao)}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-brand-muted flex items-center gap-1">
                    Taxa de plataforma
                    <span className="bg-brand-lilac text-brand-purple-dark text-[10px] px-1.5 rounded-full">INO RUN</span>
                  </span>
                  <span className="text-brand-muted font-medium">{formataBRL(TAXA_PLATAFORMA)}</span>
                </div>
                <div className="flex items-baseline justify-between border-t border-brand-lilac-mid pt-2 mt-1">
                  <span className="text-brand-muted text-[14px]">Total a pagar</span>
                  <span className="font-display font-extrabold text-[36px] text-brand-purple">{formataBRL(total)}</span>
                </div>
              </div>
            </div>


            {/* Pagamento — apenas Pix disponível na fase atual */}
            <div className="p-4 rounded-xl border-2 border-brand-purple-mid bg-brand-lilac flex items-center justify-between">
              <div>
                <div className="font-bold text-brand-ink flex items-center gap-2">
                  <span className="text-[18px]">🔑</span> Pix
                </div>
                <div className="text-[12px] text-brand-muted mt-0.5">Confirmação imediata após o pagamento</div>
              </div>
              <span className="bg-brand-purple text-white text-[11px] font-bold px-3 py-1 rounded-full">Selecionado</span>
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

        {/* ── STEP 5A: Em Análise (comprovante recebido, aguardando revisão) ── */}
        {step === 5 && emAnalise && (
          <div className="mt-6 animate-fade-up">
            <div className="flex flex-col items-center text-center py-6">
              <div className="relative mb-5">
                <div className="w-24 h-24 rounded-full bg-amber-50 border-4 border-amber-300 flex items-center justify-center shadow-brand-lg">
                  <span className="text-5xl">⏳</span>
                </div>
                <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-amber-400 border-4 border-white flex items-center justify-center shadow">
                  <span className="text-white text-[14px] font-black">✉</span>
                </div>
              </div>
              <h2 className="font-display font-extrabold italic uppercase text-[30px] text-brand-ink leading-tight tracking-tight">
                Comprovante Recebido!
              </h2>
              <p className="text-brand-muted mt-2 text-[14px]">Sua inscrição está sendo verificada pela nossa equipe.</p>
            </div>

            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 mb-4 text-center">
              <div className="text-[13px] font-bold text-amber-800 mb-1">⏱ Verificação em andamento</div>
              <p className="text-[13px] text-amber-700">
                Sua inscrição será confirmada em até <strong>24 horas</strong> após verificação manual do comprovante.
              </p>
              <p className="text-[12px] text-amber-600 mt-2">
                Você receberá um email de confirmação assim que for aprovado.
              </p>
            </div>

            <div className="bg-brand-lilac border border-brand-lilac-mid rounded-2xl p-5 mb-4 text-center">
              <p className="text-[13px] text-brand-muted mb-1">Email de aviso enviado para</p>
              <p className="font-bold text-brand-purple-dark text-[15px] break-all">{f.email}</p>
              <p className="text-[12px] text-brand-muted mt-2">Verifique sua caixa de entrada e o spam.</p>
            </div>

            <div className="bg-white border border-brand-lilac-mid rounded-2xl p-5 mb-4 text-left">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-muted mb-3">Sua inscrição</div>
              <div className="space-y-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-brand-muted">Atleta</span>
                  <span className="font-semibold text-brand-ink">{f.nome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-muted">Prova</span>
                  <span className="font-semibold text-brand-ink">Prova {f.dist === '5km' ? '5 km' : f.dist === '10km' ? '10 km' : f.dist || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-muted">Data</span>
                  <span className="font-semibold text-brand-ink">11/10/2026 — 07h00</span>
                </div>
                <div className="flex justify-between border-t border-brand-lilac-mid pt-2 mt-2">
                  <span className="text-brand-muted">Status</span>
                  <span className="font-bold text-amber-600">⏳ Aguardando verificação</span>
                </div>
              </div>
            </div>

            <div className="text-center text-[12px] text-brand-muted mb-6">
              Dúvidas?{' '}
              <a href="mailto:inscricoes@inorun.com.br" className="text-brand-purple font-semibold underline">
                inscricoes@inorun.com.br
              </a>
            </div>

            <button id="btn-voltar-site-analise" onClick={onDone} className="btn-primary w-full text-[18px] py-4">
              Voltar ao site
            </button>
          </div>
        )}

        {/* ── STEP 5B: Confirmação — Premium Clean ── */}
        {step === 5 && resultado && (

          <div className="mt-6 animate-fade-up">

            {/* Ícone principal animado */}
            <div className="flex flex-col items-center text-center py-6">
              <div className="relative mb-5">
                {/* Envelope */}
                <div className="w-24 h-24 rounded-full bg-brand-lilac border-4 border-brand-purple-mid flex items-center justify-center shadow-brand-lg">
                  <span className="text-5xl">✉️</span>
                </div>
                {/* Badge checkmark */}
                <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-green-500 border-4 border-white flex items-center justify-center shadow">
                  <span className="text-white text-[16px] font-black">✓</span>
                </div>
              </div>

              <h2 className="font-display font-extrabold italic uppercase text-[34px] text-brand-ink leading-tight tracking-tight">
                Inscrição Confirmada!
              </h2>

              {f.modalidade === 'kids' && (
                <p className="text-yellow-600 font-semibold mt-2 text-[14px]">
                  🏅 Todos os Kids ganham medalha e sobem ao pódio!
                </p>
              )}
              {f.modalidade === 'caminhada' && (
                <p className="text-green-600 font-semibold mt-2 text-[14px]">
                  🥇 Todos os participantes da Caminhada ganham medalha!
                </p>
              )}
            </div>

            {/* Card email destaque */}
            <div className="bg-gradient-to-br from-brand-lilac to-white border border-brand-lilac-mid rounded-2xl p-5 mb-4 text-center shadow-brand">
              <p className="text-[13px] text-brand-muted mb-1">Comprovante de inscrição enviado para</p>
              <p className="font-bold text-brand-purple-dark text-[15px] break-all">{resultado.atleta_email || f.email}</p>
              <p className="text-[12px] text-brand-muted mt-2">
                Verifique sua caixa de entrada e o spam. O email contém todos os detalhes da sua inscrição.
              </p>
            </div>

            {/* Resumo da prova */}
            <div className="bg-white border border-brand-lilac-mid rounded-2xl p-5 mb-4 text-left">
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-muted mb-3">Sua inscrição</div>
              <div className="space-y-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-brand-muted">Atleta</span>
                  <span className="font-semibold text-brand-ink">{resultado.atleta_nome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-muted">Prova</span>
                  <span className="font-semibold text-brand-ink">{resultado.prova_label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-muted">Data</span>
                  <span className="font-semibold text-brand-ink">11/10/2026 — 07h00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-muted">Local</span>
                  <span className="font-semibold text-brand-ink">Paraopeba – MG</span>
                </div>
                <div className="flex justify-between border-t border-brand-lilac-mid pt-2 mt-2">
                  <span className="text-brand-muted">Pagamento</span>
                  <span className="font-bold text-green-600">✅ Pix confirmado</span>
                </div>
              </div>
            </div>

            {/* Duvidas */}
            <div className="text-center text-[12px] text-brand-muted mb-6">
              Dúvidas? Entre em contato:{' '}
              <a href="mailto:inscricoes@inorun.com.br" className="text-brand-purple font-semibold underline">
                inscricoes@inorun.com.br
              </a>
            </div>

            <button id="btn-voltar-site" onClick={onDone} className="btn-primary w-full text-[18px] py-4">
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

      {verTabela && <TabelaMedidasModal onClose={() => setVerTabela(false)} />}
    </div>
  );
}
