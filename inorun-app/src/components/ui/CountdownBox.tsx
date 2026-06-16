interface CountdownBoxProps {
  value: number;
  label: string;
}

export default function CountdownBox({ value, label }: CountdownBoxProps) {
  const display = String(value).padStart(2, '0');

  return (
    <div className="flex flex-col items-center">
      <div
        className="bg-gradient-countdown rounded-xl p-3 min-w-[84px] text-center font-display font-extrabold text-white tabular-nums"
        style={{ fontSize: 'clamp(38px,8vw,68px)' }}
      >
        {display}
      </div>
      <span className="font-display text-[12px] tracking-[0.18em] text-brand-muted mt-2 uppercase text-center">
        {label}
      </span>
    </div>
  );
}
