import type { ReactNode } from 'react';

interface EyebrowProps {
  children: ReactNode;
  light?: boolean;
  className?: string;
}

export default function Eyebrow({ children, light = false, className = '' }: EyebrowProps) {
  return (
    <span
      className={[
        'font-display font-bold tracking-[0.2em] uppercase text-[13px]',
        light ? 'text-white/80' : 'text-brand-purple',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}
