interface KitItemProps {
  numero: number;
  item: string;
  det: string;
}

export default function KitItem({ numero, item, det }: KitItemProps) {
  return (
    <div className="card p-5 space-y-3">
      <span className="inline-flex items-center justify-center min-w-[38px] h-[38px] px-2.5 bg-brand-yellow rounded-[9px] font-display font-extrabold italic text-[20px] text-brand-ink">
        {numero}
      </span>
      <p className="font-semibold text-brand-ink">{item}</p>
      <p className="text-[13px] text-brand-muted">{det}</p>
    </div>
  );
}
