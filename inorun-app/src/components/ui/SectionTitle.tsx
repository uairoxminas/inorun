import type { ReactNode } from 'react';

interface SectionTitleProps {
  children: ReactNode;
  light?: boolean;
  className?: string;
}

export default function SectionTitle({ children, light = false, className = '' }: SectionTitleProps) {
  return (
    <h2
      className={[
        'font-display font-extrabold italic uppercase text-section leading-none mt-2',
        light ? 'text-white' : 'text-brand-ink',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </h2>
  );
}
