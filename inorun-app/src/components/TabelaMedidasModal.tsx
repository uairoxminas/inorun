// src/components/TabelaMedidasModal.tsx
// Modal com a tabela de medidas das camisetas (Unissex e Baby Look).
// Medidas oficiais do fornecedor (largura x comprimento em cm, valores em faixa).
// Largura = medida do peito (na horizontal, com a peça esticada). Comprimento = ombro à barra.

interface Medida { tam: string; idade?: string; largura: string; comprimento: string; }

const INFANTIL: Medida[] = [
  { tam: '4',  idade: '3 a 4 anos',   largura: '32 - 34', comprimento: '42 - 44' },
  { tam: '6',  idade: '5 a 6 anos',   largura: '34 - 36', comprimento: '45 - 47' },
  { tam: '8',  idade: '7 a 8 anos',   largura: '36 - 38', comprimento: '48 - 50' },
  { tam: '10', idade: '9 a 10 anos',  largura: '38 - 40', comprimento: '51 - 53' },
  { tam: '12', idade: '11 a 12 anos', largura: '40 - 42', comprimento: '54 - 56' },
  { tam: '14', idade: '13 a 14 anos', largura: '42 - 44', comprimento: '57 - 59' },
];

const UNISSEX: Medida[] = [
  { tam: 'PP',  largura: '48 - 50', comprimento: '66 - 68' },
  { tam: 'P',   largura: '50 - 52', comprimento: '68 - 70' },
  { tam: 'M',   largura: '52 - 54', comprimento: '70 - 72' },
  { tam: 'G',   largura: '54 - 56', comprimento: '72 - 74' },
  { tam: 'GG',  largura: '56 - 58', comprimento: '74 - 76' },
  { tam: 'XGG', largura: '58 - 60', comprimento: '76 - 78' },
];

const BABYLOOK: Medida[] = [
  { tam: 'P',   largura: '38 - 40', comprimento: '54 - 56' },
  { tam: 'M',   largura: '40 - 42', comprimento: '56 - 58' },
  { tam: 'G',   largura: '42 - 44', comprimento: '58 - 60' },
  { tam: 'GG',  largura: '44 - 46', comprimento: '60 - 62' },
  { tam: 'XGG', largura: '46 - 48', comprimento: '62 - 64' },
];

function Tabela({ titulo, dados }: { titulo: string; dados: Medida[] }) {
  const temIdade = dados.some(m => m.idade);
  return (
    <div>
      <div className="text-[12px] font-bold uppercase tracking-widest text-brand-purple mb-2">{titulo}</div>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="text-brand-muted text-[11px] uppercase tracking-wide bg-brand-bg">
            <th className="px-3 py-2 text-left font-medium">Tam.</th>
            {temIdade && <th className="px-3 py-2 text-left font-medium">Idade</th>}
            <th className="px-3 py-2 text-center font-medium">Largura (cm)</th>
            <th className="px-3 py-2 text-center font-medium">Comprimento (cm)</th>
          </tr>
        </thead>
        <tbody>
          {dados.map(m => (
            <tr key={m.tam} className="border-t border-brand-lilac-mid">
              <td className="px-3 py-2">
                <span className="font-display font-bold text-[14px] bg-brand-lilac text-brand-purple-dark px-2.5 py-0.5 rounded">{m.tam}</span>
              </td>
              {temIdade && <td className="px-3 py-2 text-brand-muted text-[12px]">{m.idade ?? '—'}</td>}
              <td className="px-3 py-2 text-center text-brand-ink">{m.largura}</td>
              <td className="px-3 py-2 text-center text-brand-ink">{m.comprimento}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TabelaMedidasModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-[520px] max-h-[85vh] overflow-y-auto p-6 shadow-2xl animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-extrabold italic uppercase text-[22px] text-brand-ink">
            📏 Tabela de medidas
          </h3>
          <button onClick={onClose} className="text-brand-muted text-[26px] leading-none">×</button>
        </div>

        <p className="text-[13px] text-brand-muted mb-5">
          Meça uma camiseta que sirva bem em você, com a peça esticada sobre uma superfície plana,
          e compare com os valores abaixo. Em dúvida entre dois tamanhos, escolha o maior.
        </p>

        <div className="space-y-6">
          <Tabela titulo="👕 Unissex (com manga)" dados={UNISSEX} />
          <Tabela titulo="👚 Baby Look" dados={BABYLOOK} />
          <div>
            <Tabela titulo="🎖️ Infantil (Kids)" dados={INFANTIL} />
            <p className="text-[12px] text-brand-muted mt-2">
              Para crianças maiores, os tamanhos <strong>PP, P e M</strong> seguem a tabela Unissex acima.
            </p>
          </div>
        </div>

        <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-[12px] text-amber-800">
          Largura medida na altura do peito, com a peça esticada. Valores em cm; pode variar ± 2 cm.
        </div>

        <button onClick={onClose} className="btn-primary w-full mt-5 py-3 text-[15px]">Fechar</button>
      </div>
    </div>
  );
}
