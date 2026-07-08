// src/components/TabelaMedidasModal.tsx
// Modal com a tabela de medidas das camisetas (Unissex e Baby Look).
// Medidas oficiais do fornecedor (em cm). Tolerância de ±1 cm.
// A=Largura Tórax · B=Largura Barra · C=Compr. Frontal · D=Compr. Traseiro · E=Compr. Manga · F=Largura Manga

interface MedidaDetalhe {
  tam: string;
  A: number; // Largura do Tórax
  B: number; // Largura da Barra
  C: number; // Comprimento Frontal
  D: number; // Comprimento Traseiro
  E: number; // Comprimento Manga
  F: number; // Largura Manga
}

// ── Unissex (Normal) ── P / M / G / GG / EXG / ESP
const UNISSEX: MedidaDetalhe[] = [
  { tam: 'P',   A: 50, B: 49, C: 67, D: 68, E: 20, F: 17 },
  { tam: 'M',   A: 53, B: 56, C: 71, D: 72, E: 22, F: 18 },
  { tam: 'G',   A: 56, B: 56, C: 72, D: 73, E: 23, F: 19 },
  { tam: 'GG',  A: 61, B: 60, C: 75, D: 77, E: 24, F: 22 },
  { tam: 'XGG', A: 64, B: 64, C: 77, D: 77, E: 27, F: 23 },
];

// ── Baby Look ── P / M / G / GG / EXG
const BABYLOOK: MedidaDetalhe[] = [
  { tam: 'P',   A: 42, B: 41, C: 54, D: 56, E: 15, F: 14 },
  { tam: 'M',   A: 44, B: 43, C: 56, D: 57, E: 15, F: 15 },
  { tam: 'G',   A: 48, B: 48, C: 60, D: 61, E: 16, F: 17 },
  { tam: 'GG',  A: 51, B: 51, C: 62, D: 63, E: 16, F: 17 },
  { tam: 'XGG', A: 56, B: 55, C: 68, D: 69, E: 18, F: 19 },
];

const MEDIDAS_LEGENDA = [
  { letra: 'A', desc: 'Largura do Tórax' },
  { letra: 'B', desc: 'Largura da Barra' },
  { letra: 'C', desc: 'Comprimento Frontal' },
  { letra: 'D', desc: 'Comprimento Traseiro' },
  { letra: 'E', desc: 'Comprimento Manga' },
  { letra: 'F', desc: 'Largura Manga' },
];

function TabelaDetalhada({ titulo, emoji, dados }: { titulo: string; emoji: string; dados: MedidaDetalhe[] }) {
  const colunas = dados.map(d => d.tam);
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[18px]">{emoji}</span>
        <span className="text-[13px] font-extrabold uppercase tracking-widest text-brand-purple">{titulo}</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-brand-lilac-mid">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-brand-purple text-white">
              <th className="px-3 py-2.5 text-left font-bold text-[11px] uppercase tracking-wider min-w-[110px]">
                Medida
              </th>
              {colunas.map(tam => (
                <th key={tam} className="px-3 py-2.5 text-center font-bold text-[13px] min-w-[44px]">
                  {tam}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEDIDAS_LEGENDA.map((m, idx) => (
              <tr key={m.letra} className={idx % 2 === 0 ? 'bg-white' : 'bg-brand-bg'}>
                <td className="px-3 py-2 text-brand-muted text-[12px] font-medium">
                  <span className="inline-flex items-center justify-center w-5 h-5 bg-brand-purple text-white rounded-full text-[10px] font-black mr-1.5">
                    {m.letra}
                  </span>
                  {m.desc}
                </td>
                {dados.map(d => (
                  <td key={d.tam} className="px-3 py-2 text-center font-semibold text-brand-ink">
                    {d[m.letra as keyof MedidaDetalhe]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function TabelaMedidasModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-[580px] sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh] animate-fade-up">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-lilac-mid sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="font-display font-extrabold italic uppercase text-[20px] text-brand-ink">
            📏 Tabela de medidas
          </h3>
          <button id="btn-fechar-tabela-medidas" onClick={onClose}
            className="text-brand-muted hover:text-brand-ink p-1 rounded-lg hover:bg-brand-lilac transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
              <path d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Conteúdo */}
        <div className="overflow-y-auto px-5 py-5 space-y-6">

          {/* Legenda visual */}
          <div className="bg-brand-lilac border border-brand-lilac-mid rounded-xl px-4 py-3">
            <p className="text-[12px] text-brand-purple-dark font-semibold mb-2 uppercase tracking-wide">Referência das medidas (em cm)</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {MEDIDAS_LEGENDA.map(m => (
                <div key={m.letra} className="flex items-center gap-1.5 text-[12px] text-brand-muted">
                  <span className="inline-flex items-center justify-center w-4 h-4 bg-brand-purple text-white rounded-full text-[9px] font-black flex-shrink-0">
                    {m.letra}
                  </span>
                  {m.desc}
                </div>
              ))}
            </div>
          </div>

          <TabelaDetalhada titulo="Unissex (Normal)" emoji="👕" dados={UNISSEX} />
          <TabelaDetalhada titulo="Baby Look" emoji="👚" dados={BABYLOOK} />

          {/* Tolerância */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-[12px] text-amber-800 font-medium text-center">
            ⚠️ Tolerância de ±1 cm para mais ou para menos. Em dúvida entre dois tamanhos, escolha o maior.
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-brand-lilac-mid sticky bottom-0 bg-white rounded-b-2xl">
          <button id="btn-fechar-tabela-ok" onClick={onClose} className="btn-primary w-full py-3 text-[15px]">
            Entendi, fechar
          </button>
        </div>
      </div>
    </div>
  );
}
