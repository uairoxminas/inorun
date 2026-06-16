interface LogoProps {
  height?: number;
  className?: string;
  light?: boolean;
}

export default function Logo({ height = 36, className = '', light = false }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt="INO RUN 2026"
      height={height}
      style={{ height }}
      className={[
        'w-auto',
        light ? 'brightness-0 invert' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
