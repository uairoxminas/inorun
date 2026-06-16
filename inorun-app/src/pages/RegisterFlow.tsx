// src/pages/RegisterFlow.tsx
// Fluxo de inscrição em 5 passos — INO RUN 2026
// Dados: gemini.md. Validação: calcCategoria + validaCPF (módulos puros).
// NOTA: neste estágio (Phase 4 antecipada) os dados são mock local.
//       Na Phase 3 (Architect) será conectado ao Supabase Edge Function.

import { useState, useMemo } from 'react';
import Logo from '../components/Logo';
import { calcCategoria } from '../lib/calcCategoria';
import { validaCPF, formataCPF } from '../lib/validaCPF';
import { precoLoteAtual, formataBRL } from '../lib/precoLoteAtual';

interface Props {
  onBack: () => void;
  onDone: () => void;
}

const STEPS = ['Prova', 'Seus dados', 'Categoria & kit', 'Pagamento', 'Confirmação'];
const CAMISETAS = ['PP', 'P', 'M', 'G', 'GG', 'XG'] as const;
const CUPONS: Record<string, number> = { 'INO10': 0.10, 'INO15': 0.15 };

interface FormState {
  dist: '5km' | '10km' | '';
  nome: string; cpf: string; nasc: string; sexo: 'M' | 'F' | '';
  email: string; tel: string; emergencia: string;
  camiseta: string; cupom: string; pag: 'pix' | 'cartao';
  termo: boolean;
}

export default function RegisterFlow({ onBack, onDone }: Props) {
  const [step, setStep] = useState(1);
  const [f, setF] = useState<FormState>({
    dist: '', nome: '', cpf: '', nasc: '', sexo: '',
    email: '', tel: '', emergencia: '',
    camiseta: '', cupom: '', pag: 'pix', termo: false,
  });
  const [cpfError, setCpfError] = useState('');

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setF(p => ({ ...p, [k]: v }));

  const loteAtual = f.dist ? precoLoteAtual(f.dist) : null;
  const precoBase = loteAtual?.preco_centavos ?? 0;
  const cupomKey = f.cupom.trim().toUpperCase();
  const desconto = CUPONS[cupomKey] ?? 0;
  const totalCentavos = Math.round(precoBase * (1 - desconto));

  const categoria = useMemo(() => {
    if (!f.nasc || !f.sexo) return '—';
    return calcCategoria(new Date(f.nasc), f.sexo as 'M' | 'F');
  }, [f.nasc, f.sexo]);

  // bib mock — na Phase 3 vem do Supabase após pagamento confirmado
  const bib = useMemo(() => String(1100 + Math.floor(Math.random() * 900)), []);

  const canAdvance = {
    1: !!f.dist,
    2: !!f.nome && !!f.cpf && !!f.nasc && !!f.sexo && !!f.email && !cpfError,
    3: !!f.camiseta,
    4: f.termo,
  } as Record<number, boolean>;

  const handleCpfBlur = () => {
    if (f.cpf && !validaCPF(f.cpf)) setCpfError('CPF inválido');
    else setCpfError('');
  };

  const PROVAS_INFO = [
    { id: '5km' as const, label: 'Prova 5 km', tag: 'Iniciante' },
    { id: '10km' as const, label: 'Prova 10 km', tag: 'Performance' },
  ];

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

        {/* ── Seção informativa (RULE: inserir objetivos/instruções em cada tela) ── */}
        <div className="mt-5 bg-brand-lilac border border-brand-lilac-mid rounded-xl px-4 py-3 text-[13px] text-brand-purple-dark">
          <strong>Fluxo de inscrição em 5 passos:</strong> prova → dados pessoais → categoria &amp; kit → pagamento → confirmação.
          {' '}CPF único por prova. Categoria calculada automaticamente pela idade em 11/10/2026.
        </div>

        {/* Progress bar */}
        <div className="mt-4 flex gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className={`flex-1 h-1 rounded-full transition-all duration-300 ${i < step ? 'bg-brand-purple' : 'bg-brand-lilac-mid'}`} />
          ))}
        </div>
        <div className="font-display italic tracking-[0.1em] text-[13px] text-brand-purple mt-2 uppercase">
          Passo {step} de 5 · {STEPS[step - 1]}
        </div>

        {/* ── STEP 1: Prova ── */}
        {step === 1 && (
          <div className="mt-6 grid gap-3">
            {PROVAS_INFO.map(p => {
              const lote = precoLoteAtual(p.id);
              return (
                <button
                  key={p.id}
                  id={`select-prova-${p.id}`}
                  onClick={() => set('dist', p.id)}
                  className={`flex items-center justify-between text-left p-5 rounded-2xl border-2 transition-all duration-150
                    ${f.dist === p.id
                      ? 'bg-brand-lilac border-brand-purple-mid shadow-brand'
                      : 'bg-white border-brand-lilac-mid hover:border-brand-purple-mid'}`}
                >
                  <div>
                    <div className="font-display font-extrabold italic text-[26px] uppercase text-brand-ink">{p.label}</div>
                    <div className="text-[13px] text-brand-muted">{p.tag}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[12px] text-brand-muted">a partir de</div>
                    <div className="font-display font-extrabold text-[24px] text-brand-purple">
                      {lote ? formataBRL(lote.preco_centavos) : '—'}
                    </div>
                    <div className="text-[11px] text-brand-muted">{lote?.nome}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── STEP 2: Dados pessoais ── */}
        {step === 2 && (
          <div className="mt-6 grid gap-4">
            <div>
              <label className="label">Nome completo</label>
              <input id="input-nome" className="input" value={f.nome}
                onChange={e => set('nome', e.target.value)} placeholder="Como no documento" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">CPF</label>
                <input id="input-cpf" className={`input ${cpfError ? 'border-red-400 focus:ring-red-400' : ''}`}
                  value={f.cpf}
                  onChange={e => set('cpf', formataCPF(e.target.value.replace(/\D/g, '')))}
                  onBlur={handleCpfBlur}
                  placeholder="000.000.000-00" maxLength={14} />
                {cpfError && <p className="text-red-500 text-[12px] mt-1">{cpfError}</p>}
              </div>
              <div>
                <label className="label">Nascimento</label>
                <input id="input-nasc" type="date" className="input" value={f.nasc}
                  onChange={e => set('nasc', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Sexo (para categoria)</label>
              <div className="flex gap-3">
                {(['M', 'F'] as const).map(sx => (
                  <button key={sx} id={`select-sexo-${sx}`}
                    onClick={() => set('sexo', sx)}
                    className={`flex-1 py-3 rounded-xl font-semibold border-2 transition-all duration-150
                      ${f.sexo === sx
                        ? 'bg-brand-purple text-white border-brand-purple'
                        : 'bg-white text-brand-ink border-brand-lilac-mid hover:border-brand-purple'}`}>
                    {sx === 'M' ? 'Masculino' : 'Feminino'}
                  </button>
                ))}
              </div>
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
                <label className="label">Contato de emergência</label>
                <input id="input-emergencia" className="input" value={f.emergencia}
                  onChange={e => set('emergencia', e.target.value)} placeholder="Nome e telefone" />
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Categoria & kit ── */}
        {step === 3 && (
          <div className="mt-6 grid gap-5">
            {/* Categoria calculada */}
            <div className="bg-white border border-brand-lilac-mid rounded-2xl p-5">
              <div className="text-[13px] text-brand-muted">Sua categoria (calculada pela idade em 11/10/2026)</div>
              <div className="font-display font-extrabold italic text-[32px] text-brand-purple mt-1">{categoria}</div>
              {categoria !== '—' && (
                <div className="text-[12px] text-brand-muted mt-1">
                  Premiação individual por faixa etária e sexo
                </div>
              )}
            </div>

            {/* Camiseta */}
            <div>
              <label className="label">Tamanho da camiseta</label>
              <div className="flex flex-wrap gap-2">
                {CAMISETAS.map(c => (
                  <button key={c} id={`select-camiseta-${c}`}
                    onClick={() => set('camiseta', c)}
                    className={`w-14 py-3 rounded-xl font-display font-bold text-[16px] border-2 transition-all duration-150
                      ${f.camiseta === c
                        ? 'bg-brand-purple text-white border-brand-purple'
                        : 'bg-white text-brand-ink border-brand-lilac-mid hover:border-brand-purple'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Cupom */}
            <div>
              <label className="label">Cupom de desconto (opcional)</label>
              <input id="input-cupom" className="input" value={f.cupom}
                onChange={e => set('cupom', e.target.value.toUpperCase())}
                placeholder="Ex: INO10" />
              {desconto > 0 && (
                <div className="text-brand-purple text-[13px] mt-1.5 font-semibold">
                  ✓ Cupom aplicado: {Math.round(desconto * 100)}% de desconto
                </div>
              )}
              {f.cupom && !desconto && (
                <div className="text-red-500 text-[13px] mt-1.5">Cupom inválido ou expirado</div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 4: Pagamento ── */}
        {step === 4 && (
          <div className="mt-6 grid gap-5">
            {/* Resumo */}
            <div className="bg-white border border-brand-lilac-mid rounded-2xl p-5">
              <div className="text-[14px] text-brand-muted">
                {f.dist === '5km' ? 'Prova 5 km' : 'Prova 10 km'} · {categoria} · Camiseta {f.camiseta}
              </div>
              {loteAtual && (
                <div className="text-[12px] text-brand-muted mt-0.5">{loteAtual.nome}</div>
              )}
              {desconto > 0 && (
                <div className="flex justify-between mt-2 text-[13px]">
                  <span className="text-brand-muted">Desconto ({Math.round(desconto * 100)}%)</span>
                  <span className="text-green-600">−{formataBRL(precoBase * desconto)}</span>
                </div>
              )}
              <div className="mt-3 flex items-baseline justify-between border-t border-brand-lilac-mid pt-3">
                <span className="text-brand-muted text-[14px]">Total</span>
                <span className="font-display font-extrabold text-[36px] text-brand-purple">
                  {formataBRL(totalCentavos)}
                </span>
              </div>
            </div>

            {/* Método de pagamento */}
            <div className="grid grid-cols-2 gap-3">
              {([
                ['pix', 'Pix', 'Confirmação na hora'] as const,
                ['cartao', 'Cartão', 'Em até 12x'] as const,
              ]).map(([id, titulo, sub]) => (
                <button key={id} id={`select-pag-${id}`}
                  onClick={() => set('pag', id)}
                  className={`text-left p-4 rounded-xl border-2 transition-all duration-150
                    ${f.pag === id
                      ? 'bg-brand-lilac border-brand-purple-mid'
                      : 'bg-white border-brand-lilac-mid hover:border-brand-purple-mid'}`}>
                  <div className="font-bold text-brand-ink">{titulo}</div>
                  <div className="text-[12px] text-brand-muted mt-0.5">{sub}</div>
                </button>
              ))}
            </div>

            {/* Termo */}
            <label className="flex items-start gap-3 text-[13px] text-brand-muted cursor-pointer">
              <input id="check-termo" type="checkbox" checked={f.termo}
                onChange={e => set('termo', e.target.checked)}
                className="mt-0.5 accent-brand-purple w-4 h-4 rounded" />
              <span>
                Li e aceito o{' '}
                <span className="text-brand-purple underline">termo de responsabilidade</span>
                {' '}e declaro estar apto(a) a participar da prova.
              </span>
            </label>
          </div>
        )}

        {/* ── STEP 5: Confirmação ── */}
        {step === 5 && (
          <div className="mt-6 text-center py-5 animate-fade-up">
            {/* Ícone de sucesso */}
            <div className="w-16 h-16 rounded-full bg-brand-purple text-white flex items-center justify-center mx-auto text-3xl font-bold shadow-brand-lg">
              ✓
            </div>
            <h2 className="font-display font-extrabold italic uppercase text-[36px] text-brand-ink mt-4 leading-tight">
              Inscrição confirmada
            </h2>
            <p className="text-brand-muted mt-2">
              {f.nome || 'Atleta'}, sua vaga na{' '}
              {f.dist === '5km' ? 'Prova 5 km' : 'Prova 10 km'} está garantida.
            </p>

            {/* Card número de peito */}
            <div className="bg-white border border-brand-lilac-mid rounded-2xl p-6 mt-6 shadow-brand">
              <div className="text-[12px] text-brand-muted tracking-[0.15em] uppercase">Seu número de peito</div>
              <div className="font-display font-extrabold italic text-[80px] text-brand-purple leading-none my-2">
                {bib}
              </div>
              <div className="text-[12px] text-brand-muted mb-3">
                {categoria} · {f.dist === '5km' ? '5 km' : '10 km'}
              </div>

              {/* QR code simulado */}
              <div className="w-24 h-24 mx-auto rounded-lg overflow-hidden border-4 border-brand-ink"
                style={{
                  background: 'repeating-conic-gradient(#26122E 0% 25%, #fff 0% 50%)',
                  backgroundSize: '16px 16px'
                }} />
              <div className="text-[12px] text-brand-muted mt-2">
                QR de check-in · enviado ao e-mail cadastrado
              </div>
            </div>

            <div className="mt-3 text-[13px] text-brand-muted">
              ⚠️ <em>Nota de desenvolvimento: bib e QR são mock. Na Phase 3 (Architect) o número será gerado pelo Supabase após webhook de pagamento.</em>
            </div>

            <button id="btn-voltar-site" onClick={onDone}
              className="btn-primary mt-6 text-[18px] px-8 py-4">
              Voltar ao site
            </button>
          </div>
        )}

        {/* Botão avançar */}
        {step < 5 && (
          <button
            id={`btn-step-${step}-avancar`}
            disabled={!canAdvance[step]}
            onClick={() => setStep(s => s + 1)}
            className={`w-full mt-7 py-4 rounded-xl font-display font-bold italic text-[18px] tracking-wider uppercase transition-all duration-150
              ${canAdvance[step]
                ? 'bg-brand-purple text-white hover:bg-brand-purple-dark active:scale-95 shadow-brand'
                : 'bg-brand-lilac-mid text-brand-muted cursor-not-allowed'}`}>
            {step === 4 ? `Pagar ${formataBRL(totalCentavos)}` : 'Continuar'}
          </button>
        )}
      </div>
    </div>
  );
}
