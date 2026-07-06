// src/components/StravaRoute.tsx
// Embed oficial de rota do Strava. Requer que a rota esteja PÚBLICA nas
// configurações do dono no Strava — senão o iframe não renderiza.

import { useEffect } from 'react';

interface Props {
  routeId: string;
  /** URL da rota no Strava (para o link de fallback). */
  routeUrl?: string;
}

export default function StravaRoute({ routeId, routeUrl }: Props) {
  useEffect(() => {
    // O embed.js varre a página e substitui o placeholder por um iframe.
    // Re-injetar a cada montagem garante o processamento em SPA.
    const script = document.createElement('script');
    script.src = 'https://strava-embeds.com/embed.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      try { document.body.removeChild(script); } catch { /* já removido */ }
    };
  }, [routeId]);

  return (
    <div className="rounded-2xl overflow-hidden bg-brand-lilac min-h-[280px]">
      <div
        className="strava-embed-placeholder"
        data-embed-type="route"
        data-embed-id={routeId}
        data-units="metric"
        data-full-width="true"
        data-style="standard"
        data-terrain="2d"
      />
      {routeUrl && (
        <div className="px-4 py-2 text-[12px] text-brand-muted">
          Não carregou?{' '}
          <a href={routeUrl} target="_blank" rel="noreferrer"
            className="text-brand-purple font-semibold underline">
            Ver o percurso no Strava
          </a>
        </div>
      )}
    </div>
  );
}
