// src/pages/admin/CheckIn.tsx — Check-in no evento (modo mobile)

import { useState, useEffect, useRef } from 'react';
import { fazerCheckin, getInscritos } from '../../services/adminService';

interface CheckInResult {
  ok: boolean;
  erro?: string;
  nome?: string;
  categoria?: string;
  prova?: string;
  camiseta?: string;
}

export default function CheckIn() {
  const [bib, setBib]           = useState('');
  const [resultado, setResultado] = useState<CheckInResult | null>(null);
  const [processando, setProcessando] = useState(false);
  const [checkins, setCheckins] = useState(0);
  const [total, setTotal]       = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Busca totais para o contador
    getInscritos().then(rows => {
      setTotal(rows.filter(r => r.status === 'confirmado').length);
      setCheckins(rows.filter(r => r.checked_in_at).length);
    });
    inputRef.current?.focus();
  }, []);

  const handleCheckin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const n = parseInt(bib.trim());
    if (!n || isNaN(n)) return;

    setProcessando(true);
    const res = await fazerCheckin(n);
    setResultado(res);
    setBib('');
    setProcessando(false);

    if (res.ok) {
      setCheckins(c => c + 1);
      // Vibração (se suportado)
      if ('vibrate' in navigator) navigator.vibrate(200);
    } else {
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    }

    // Limpa resultado após 4s e re-foca o input
    setTimeout(() => {
      setResultado(null);
      inputRef.current?.focus();
    }, 4000);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display font-extrabold italic uppercase text-[32px] text-brand-ink leading-none">
            Check-in
          </h2>
          <p className="text-[13px] text-brand-muted mt-1">11/10/2026 · INO RUN 2026</p>
        </div>
        <div className="text-right">
          <div className="font-display font-extrabold text-[28px] text-brand-purple leading-none">{checkins}</div>
          <div className="text-[11px] text-brand-muted">de {total} atletas</div>
        </div>
      </div>

      <div className="bg-brand-lilac rounded-xl px-4 py-3 text-[13px] text-brand-purple-dark">
        <strong>Como usar:</strong> Digite o número do bib e pressione Enter.
        Para QR Code: aponte a câmera para o código e o número será lido automaticamente.
        O feedback aparece por 4 segundos.
      </div>

      {/* Barra de progresso dos check-ins */}
      {total > 0 && (
        <div>
          <div className="flex justify-between text-[12px] text-brand-muted mb-1">
            <span>Progresso do check-in</span>
            <span>{Math.round((checkins / total) * 100)}%</span>
          </div>
          <div className="h-3 bg-brand-lilac rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${(checkins / total) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Input de bib */}
      <form onSubmit={handleCheckin} className="relative">
        <input
          ref={inputRef}
          id="input-bib-checkin"
          type="number"
          value={bib}
          onChange={e => setBib(e.target.value)}
          placeholder="Número do bib"
          className="input text-center text-[32px] font-display font-bold py-5 pr-24"
          style={{ fontSize: 'clamp(24px,6vw,40px)' }}
          min={1}
          autoFocus
        />
        <button type="submit" disabled={processando || !bib}
          className={`absolute right-2 top-1/2 -translate-y-1/2 btn-primary py-2.5 px-5 text-[14px] ${!bib ? 'opacity-50' : ''}`}>
          {processando ? '...' : '✓'}
        </button>
      </form>

      {/* Resultado */}
      {resultado && (
        <div className={`rounded-2xl p-6 text-center transition-all duration-300 ${
          resultado.ok
            ? 'bg-green-50 border-2 border-green-400'
            : 'bg-red-50 border-2 border-red-400'
        }`}>
          <div style={{ fontSize: 56 }}>{resultado.ok ? '✅' : '❌'}</div>
          {resultado.ok ? (
            <>
              <h3 className="font-display font-extrabold italic uppercase text-[28px] text-green-700 mt-2 leading-tight">
                Check-in OK!
              </h3>
              <p className="text-green-600 font-semibold text-[18px] mt-1">{resultado.nome}</p>
              <div className="flex justify-center gap-4 mt-3">
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[13px] font-medium">
                  {resultado.categoria}
                </span>
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[13px] font-medium">
                  {resultado.prova}
                </span>
                <span className="bg-brand-yellow text-brand-ink px-3 py-1 rounded-full text-[13px] font-bold">
                  Camiseta {resultado.camiseta}
                </span>
              </div>
            </>
          ) : (
            <>
              <h3 className="font-display font-extrabold italic uppercase text-[24px] text-red-600 mt-2">
                Problema
              </h3>
              <p className="text-red-500 text-[16px] mt-1">{resultado.erro}</p>
            </>
          )}
        </div>
      )}

      {/* Histórico rápido */}
      <div className="card p-5">
        <div className="font-semibold text-brand-ink mb-3">Atalhos</div>
        <div className="grid grid-cols-2 gap-3 text-[13px] text-brand-muted">
          <div className="bg-brand-lilac rounded-xl p-3">
            <span className="font-bold text-brand-purple">Enter</span> — confirmar bib
          </div>
          <div className="bg-brand-lilac rounded-xl p-3">
            <span className="font-bold text-brand-purple">QR Code</span> — leitura automática pela câmera
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-green-700">
            <span className="font-bold">Verde</span> — check-in realizado
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-red-600">
            <span className="font-bold">Vermelho</span> — problema ou duplicado
          </div>
        </div>
      </div>
    </div>
  );
}
