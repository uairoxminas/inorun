// src/pages/admin/Cronograma.tsx — Cronograma de largadas por categoria

import { useState, useEffect } from 'react';
import { getWaves, salvarOnda } from '../../services/adminService';
import type { WaveRow } from '../../services/adminService';
import { supabase } from '../../lib/supabase';

const CATEGORIAS_TODAS = [
  'F Sub-20','M Sub-20','F 20-24','M 20-24','F 25-29','M 25-29',
  'F 30-34','M 30-34','F 35-39','M 35-39','F 40-44','M 40-44',
  'F 45-49','M 45-49','F 50+','M 50+',
];
const CORES = ['#8417AE','#5B0E7A','#A93FD0','#FFD200','#FF6B35','#2D9CDB'];

export default function Cronograma() {
  const [waves, setWaves]     = useState<WaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<WaveRow | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [races, setRaces]     = useState<{ id: string; label: string }[]>([]);

  const carregar = async () => {
    setLoading(true);
    const [ws, { data: rs }] = await Promise.all([
      getWaves(),
      supabase.from('race').select('id,label').order('distancia_km'),
    ]);
    setWaves(ws);
    setRaces(rs ?? []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const iniciarEdicao = (w?: WaveRow) => {
    setEditando(w ?? {
      id: '', race_id: races[0]?.id ?? '',
      nome: '', categorias: [], largada_at: '2026-10-11T07:00:00',
      ordem: waves.length + 1, cor: '#8417AE',
    });
  };

  const handleSalvar = async () => {
    if (!editando) return;
    setSalvando(true);
    await salvarOnda({ ...editando, id: editando.id || undefined });
    await carregar();
    setEditando(null);
    setSalvando(false);
  };

  const toggleCategoria = (cat: string) => {
    if (!editando) return;
    const has = editando.categorias.includes(cat);
    setEditando({ ...editando, categorias: has ? editando.categorias.filter(c => c !== cat) : [...editando.categorias, cat] });
  };

  // Agrupa por prova
  const waves5k  = waves.filter(w => w.prova?.includes('5'));
  const waves10k = waves.filter(w => w.prova?.includes('10'));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display font-extrabold italic uppercase text-[32px] text-brand-ink leading-none">
            Cronograma
          </h2>
          <p className="text-[13px] text-brand-muted mt-1">Largadas por onda · 11/10/2026</p>
        </div>
        <button id="btn-nova-onda" onClick={() => iniciarEdicao()}
          className="btn-primary text-[13px] py-2 px-5">
          + Nova onda
        </button>
      </div>

      <div className="bg-brand-lilac rounded-xl px-4 py-3 text-[13px] text-brand-purple-dark">
        <strong>Objetivo:</strong> defina as ondas/grupos de largada por categoria e horário.
        Isso gera o cronograma oficial do evento para organização e comunicação aos atletas.
        As categorias são calculadas automaticamente (sexo + faixa etária em 11/10/2026).
      </div>

      {loading ? (
        <div className="space-y-3">{[0,1,2].map(i => <div key={i} className="h-20 bg-brand-lilac rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {[{ label: 'Prova 5 km', ws: waves5k }, { label: 'Prova 10 km', ws: waves10k }].map(({ label, ws }) => (
            <div key={label}>
              <h3 className="font-display font-bold text-[20px] text-brand-ink mb-3">{label}</h3>
              <div className="space-y-3">
                {ws.length === 0 ? (
                  <p className="text-brand-muted text-[13px]">Nenhuma onda configurada</p>
                ) : ws.map(w => (
                  <div key={w.id} className="card p-4" style={{ borderLeft: `4px solid ${w.cor}` }}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-brand-ink">{w.nome}</div>
                        <div className="text-[13px] text-brand-muted mt-0.5">
                          🕐 {new Date(w.largada_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {w.categorias.map(c => (
                            <span key={c} className="text-[11px] bg-brand-lilac text-brand-purple-dark px-2 py-0.5 rounded-full">{c}</span>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => iniciarEdicao(w)}
                        className="btn-ghost text-[13px] shrink-0">Editar</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de edição */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditando(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-[560px] max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-bold text-[22px] italic uppercase text-brand-ink">
                {editando.id ? 'Editar onda' : 'Nova onda'}
              </h3>
              <button onClick={() => setEditando(null)} className="text-2xl text-brand-muted">×</button>
            </div>

            <div className="grid gap-4">
              <div>
                <label className="label">Prova</label>
                <select className="input" value={editando.race_id}
                  onChange={e => setEditando({ ...editando, race_id: e.target.value })}>
                  {races.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Nome da onda</label>
                <input className="input" value={editando.nome}
                  onChange={e => setEditando({ ...editando, nome: e.target.value })}
                  placeholder="Ex: Onda A — Feminino Geral" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Horário de largada</label>
                  <input type="datetime-local" className="input" value={editando.largada_at?.slice(0, 16)}
                    onChange={e => setEditando({ ...editando, largada_at: e.target.value + ':00' })} />
                </div>
                <div>
                  <label className="label">Ordem</label>
                  <input type="number" className="input" value={editando.ordem}
                    onChange={e => setEditando({ ...editando, ordem: parseInt(e.target.value) })} min={1} />
                </div>
              </div>
              <div>
                <label className="label">Cor de identificação</label>
                <div className="flex gap-2 flex-wrap">
                  {CORES.map(c => (
                    <button key={c} onClick={() => setEditando({ ...editando, cor: c })}
                      className={`w-8 h-8 rounded-full border-4 transition-all ${editando.cor === c ? 'border-brand-ink scale-110' : 'border-white'}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Categorias desta onda</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {CATEGORIAS_TODAS.map(c => (
                    <button key={c} onClick={() => toggleCategoria(c)}
                      className={`text-[12px] px-3 py-1 rounded-full border transition-all ${
                        editando.categorias.includes(c)
                          ? 'bg-brand-purple text-white border-brand-purple'
                          : 'bg-white text-brand-muted border-brand-lilac-mid hover:border-brand-purple'
                      }`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditando(null)} className="btn-ghost flex-1">Cancelar</button>
              <button id="btn-salvar-onda" onClick={handleSalvar} disabled={salvando || !editando.nome}
                className="btn-primary flex-1">
                {salvando ? 'Salvando...' : 'Salvar onda'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
