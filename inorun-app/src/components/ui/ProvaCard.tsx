import { formataBRL } from '../../lib/precoLoteAtual';

export type ProvaId = '5km' | '10km';

interface ProvaCardProps {
  id: ProvaId;
  km: string;
  label: string;
  tag: string;
  desc: string;
  preco: number;
  onInscrever: () => void;
}

const IconArrow = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <path
      d="M5 12h11M11 7l5 5-5 5"
      stroke="#fff"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconShield = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 2l8 3v6c0 5-3.5 8-8 11-4.5-3-8-6-8-11V5l8-3z"
      stroke="#fff"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

export default function ProvaCard({
  id,
  km,
  label,
  tag,
  desc,
  preco,
  onInscrever,
}: ProvaCardProps) {
  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-brand p-5 flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20">
              {id === '5km' ? <IconArrow /> : <IconShield />}
            </div>
            <span className="font-display italic font-bold text-white text-2xl uppercase">
              {label}
            </span>
          </div>
          <span className="text-xs text-white/80 tracking-widest uppercase pl-[52px]">
            {tag}
          </span>
        </div>

        {/* KM */}
        <div className="flex items-end leading-none">
          <span className="text-[56px] font-display font-extrabold text-brand-yellow leading-none opacity-90">
            {km}
          </span>
          <span className="text-[28px] font-display font-extrabold text-brand-yellow opacity-90 mb-1">
            K
          </span>
        </div>
      </div>

      {/* Corpo */}
      <div className="p-6">
        <p className="text-brand-muted text-[15px] min-h-[96px]">{desc}</p>

        {/* Rodapé */}
        <div className="flex justify-between items-end mt-6">
          <div className="flex flex-col">
            <span className="text-xs text-brand-muted">a partir de</span>
            <span className="font-display font-extrabold text-[28px] text-brand-purple leading-none">
              {formataBRL(preco)}
            </span>
          </div>
          <button className="btn-primary text-base" onClick={onInscrever}>
            Inscrever-se
          </button>
        </div>
      </div>
    </div>
  );
}
