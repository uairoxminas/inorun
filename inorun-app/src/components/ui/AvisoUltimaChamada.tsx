import { FASES_KIT, kitCompletoDisponivel } from '../../lib/ultimaChamada';

// Aviso das duas fases do kit no lote Última Chamada.
// A fase vigente fica em destaque; a fase com kit aparece riscada depois de 05/10.
export default function AvisoUltimaChamada() {
  const comKit = kitCompletoDisponivel();
  return (
    <div id="aviso-ultima-chamada" className="rounded-2xl border-2 border-brand-yellow bg-yellow-50 p-4">
      <div className="font-display font-extrabold italic uppercase text-[18px] text-brand-ink leading-tight">
        ⚠️ Última Chamada — atenção ao kit
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {FASES_KIT.map(fase => {
          const vigente = fase.completo === comKit;
          const encerrada = fase.completo && !comKit;
          return (
            <div key={fase.periodo}
              className={`rounded-xl border-2 px-3.5 py-3 ${
                encerrada ? 'bg-white border-brand-lilac-mid opacity-60'
                  : fase.completo ? 'bg-green-50 border-green-400'
                  : 'bg-red-50 border-red-400'}`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[12px] font-bold uppercase tracking-wide text-brand-ink">{fase.periodo}</span>
                {vigente && <span className="badge-lot-active">Vale agora</span>}
                {encerrada && <span className="text-[11px] font-bold uppercase text-brand-muted">Encerrado</span>}
              </div>
              <div className={`mt-1 text-[14px] font-bold ${
                encerrada ? 'text-brand-muted line-through'
                  : fase.completo ? 'text-green-700'
                  : 'text-red-700'}`}>
                {fase.completo ? '👕 ' : '🚫 '}{fase.kit}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
