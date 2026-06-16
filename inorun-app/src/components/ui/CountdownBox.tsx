interface CountdownBoxProps {
  value: number;
  label: string;
}

export default function CountdownBox({ value, label }: CountdownBoxProps) {
  const display = String(value).padStart(2, '0');

  return (
    <div className="flex flex-col items-center">
      <div
        className="bg-gradient-countdown rounded-xl text-center font-display font-extrabold text-white tabular-nums"
        style={{
          fontSize: 'clamp(26px,6.5vw,62px)',
          minWidth: 'clamp(58px,14vw,90px)',
          padding: 'clamp(8px,2vw,14px)',
        }}
      >
        {display}
      </div>
      <span className="font-display tracking-[0.15em] text-brand-muted mt-1.5 uppercase text-center"
        style={{ fontSize: 'clamp(9px,2.2vw,12px)' }}>
        {label}
      </span>
    </div>
  );
}
