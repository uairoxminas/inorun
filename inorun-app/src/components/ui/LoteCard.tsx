interface LoteCardProps {
  nome: string;
  info: string;
  ativo: boolean;
}

export default function LoteCard({ nome, info, ativo }: LoteCardProps) {
  return (
    <div
      className={
        ativo
          ? 'bg-brand-lilac border border-brand-purple-mid rounded-xl p-4'
          : 'bg-brand-bg border border-brand-lilac-mid rounded-xl p-4'
      }
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="font-display font-bold text-[18px] text-brand-ink">
          {nome}
        </span>
        {ativo && (
          <span className="badge-lot-active">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-ink opacity-60" />
            Disponível agora
          </span>
        )}
      </div>
      <p className="text-[13px] text-brand-muted mt-1">{info}</p>
    </div>
  );
}
