// src/pages/AdminPanel.tsx — Shell do painel do organizador com autenticação e navegação

import { useState, useEffect } from 'react';
import Logo from '../components/Logo';
import AdminLogin from './AdminLogin';
import AdminDashboard from './admin/AdminDashboard';
import GestaoInscricoes from './admin/GestaoInscricoes';
import GestaoLotesCupons from './admin/GestaoLotesCupons';
import Cronograma from './admin/Cronograma';
import Financeiro from './admin/Financeiro';
import CheckIn from './admin/CheckIn';
import { getInscritos, calcularMetricas } from '../services/adminService';
import type { InscritoRow, MetricasAdmin } from '../services/adminService';

interface Props { onBack: () => void; totalInscritos: number; }

type Secao = 'dashboard' | 'inscricoes' | 'lotes' | 'cronograma' | 'financeiro' | 'checkin';

const NAV: { id: Secao; label: string; icon: string }[] = [
  { id: 'dashboard',  label: 'Dashboard',     icon: '📊' },
  { id: 'inscricoes', label: 'Inscrições',     icon: '🏃' },
  { id: 'lotes',      label: 'Lotes & Cupons', icon: '🎟️' },
  { id: 'cronograma', label: 'Cronograma',     icon: '🕐' },
  { id: 'financeiro', label: 'Financeiro',     icon: '💰' },
  { id: 'checkin',    label: 'Check-in',       icon: '✅' },
];

export default function AdminPanel({ onBack }: Props) {
  // Auth
  const [autenticado, setAutenticado] = useState(
    sessionStorage.getItem('admin_auth') === 'ok'
  );

  // Dados globais (carregados uma vez, passados aos módulos)
  const [inscritos, setInscritos]   = useState<InscritoRow[]>([]);
  const [metricas, setMetricas]     = useState<MetricasAdmin | null>(null);
  const [loading, setLoading]       = useState(true);
  const [eventoId, setEventoId]     = useState('');
  const [secao, setSecao]           = useState<Secao>('dashboard');
  const [menuAberto, setMenuAberto] = useState(false);

  const carregar = async () => {
    setLoading(true);
    const rows = await getInscritos();
    setInscritos(rows);
    setMetricas(calcularMetricas(rows));
    setLoading(false);
  };

  // Busca o event_id
  useEffect(() => {
    if (!autenticado) return;
    import('../lib/supabase').then(({ supabase }) => {
      supabase.from('event').select('id').eq('slug', 'inorun-2026').single()
        .then(({ data }) => setEventoId(data?.id ?? ''));
    });
    carregar();
  }, [autenticado]);

  const handleLogout = () => {
    sessionStorage.removeItem('admin_auth');
    setAutenticado(false);
  };

  if (!autenticado) {
    return <AdminLogin onLogin={() => setAutenticado(true)} />;
  }

  return (
    <div className="bg-brand-bg text-brand-ink font-sans min-h-screen flex">

      {/* ── Sidebar ── */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 bg-white border-r border-brand-lilac-mid
        flex flex-col transition-transform duration-300
        ${menuAberto ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 md:w-60
      `}>
        {/* Logo */}
        <div className="p-5 border-b border-brand-lilac-mid flex items-center justify-between">
          <Logo height={26} />
          <button onClick={() => setMenuAberto(false)} className="md:hidden text-brand-muted">×</button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          {NAV.map(n => (
            <button key={n.id} id={`nav-admin-${n.id}`}
              onClick={() => { setSecao(n.id); setMenuAberto(false); }}
              className={`w-full flex items-center gap-3 px-5 py-3.5 text-left text-[14px] font-medium transition-all duration-150
                ${secao === n.id
                  ? 'bg-brand-lilac text-brand-purple border-r-[3px] border-brand-purple'
                  : 'text-brand-muted hover:text-brand-ink hover:bg-brand-bg'
                }`}>
              <span className="text-lg">{n.icon}</span>
              {n.label}
              {n.id === 'dashboard' && metricas && (
                <span className="ml-auto font-display font-bold text-[12px] text-brand-purple">
                  {metricas.total}
                </span>
              )}
              {n.id === 'checkin' && metricas && (
                <span className="ml-auto font-display font-bold text-[12px] text-green-600">
                  {metricas.checkins}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-brand-lilac-mid">
          <button onClick={onBack} className="btn-ghost text-[12px] w-full mb-2">← Ver site</button>
          <button onClick={handleLogout} className="text-[12px] text-brand-muted hover:text-red-500 transition-colors w-full text-center">
            Sair do painel
          </button>
        </div>
      </aside>

      {/* Overlay mobile */}
      {menuAberto && <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setMenuAberto(false)} />}

      {/* ── Conteúdo ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header mobile */}
        <header className="md:hidden sticky top-0 z-10 bg-white border-b border-brand-lilac-mid px-4 py-3 flex items-center gap-3">
          <button onClick={() => setMenuAberto(true)} className="text-2xl text-brand-muted">☰</button>
          <span className="font-display font-bold italic uppercase text-brand-purple">{NAV.find(n => n.id === secao)?.label}</span>
          {metricas && <span className="ml-auto text-[12px] text-brand-muted">{metricas.confirmados} conf.</span>}
        </header>

        {/* Conteúdo principal */}
        <main className="flex-1 p-5 md:p-8 max-w-[1100px] w-full mx-auto">
          {secao === 'dashboard' && metricas && (
            <AdminDashboard
              metricas={metricas} inscritos={inscritos}
              onRecarregar={carregar} loading={loading}
            />
          )}
          {secao === 'inscricoes' && (
            <GestaoInscricoes inscritos={inscritos} onRecarregar={carregar} loading={loading} />
          )}
          {secao === 'lotes' && <GestaoLotesCupons />}
          {secao === 'cronograma' && <Cronograma />}
          {secao === 'financeiro' && eventoId && <Financeiro eventoId={eventoId} />}
          {secao === 'checkin' && <CheckIn />}

          {/* Loading state inicial */}
          {loading && secao === 'dashboard' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[0,1,2,3].map(i => <div key={i} className="h-24 bg-brand-lilac rounded-xl animate-pulse" />)}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
