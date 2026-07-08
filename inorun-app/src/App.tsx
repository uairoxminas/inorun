// src/App.tsx — INO RUN 2026
// 3 views: site público | fluxo de inscrição | painel do organizador

import './index.css';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PublicSite from './pages/PublicSite';
import RegisterFlow from './pages/RegisterFlow';
import GroupRegisterFlow from './pages/GroupRegisterFlow';
import AdminPanel from './pages/AdminPanel';
import DevHandshake from './pages/DevHandshake';

type View = 'site' | 'register' | 'grupo' | 'admin';

// ── Botão flutuante WhatsApp — renderizado direto no body via portal ──────────
const WA_NUMBER  = '5548996459791';
const WA_MESSAGE = encodeURIComponent('Olá! Preciso de ajuda com minha inscrição no INO RUN 2026. 🏃');
const WA_LINK    = `https://wa.me/${WA_NUMBER}?text=${WA_MESSAGE}`;

function WhatsAppFAB() {
  const [hovered, setHovered] = useState(false);

  const fab = (
    <a
      id="btn-whatsapp-suporte"
      href={WA_LINK}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Suporte via WhatsApp"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        textDecoration: 'none',
      }}
    >
      {/* Tooltip */}
      <span style={{
        background: '#fff',
        color: '#1a1a2e',
        fontSize: '13px',
        fontWeight: 600,
        padding: '8px 14px',
        borderRadius: '12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        border: '1px solid #e5e7eb',
        whiteSpace: 'nowrap',
        opacity: hovered ? 1 : 0,
        transform: hovered ? 'translateX(0)' : 'translateX(8px)',
        transition: 'opacity 0.2s, transform 0.2s',
        pointerEvents: hovered ? 'auto' : 'none',
      }}>
        💬 Suporte INO RUN
      </span>

      {/* Círculo verde WhatsApp */}
      <div style={{
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: '#25D366',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(37,211,102,0.55)',
        transition: 'transform 0.2s',
        transform: hovered ? 'scale(1.1)' : 'scale(1)',
        flexShrink: 0,
      }}>
        <svg viewBox="0 0 48 48" style={{ width: '30px', height: '30px' }} fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" clipRule="evenodd" fill="#fff" d="M24 4C13 4 4 13 4 24c0 3.6.97 6.97 2.66 9.87L4 44l10.4-2.72A19.88 19.88 0 0 0 24 44c11 0 20-9 20-20S35 4 24 4zm0 36.6a16.5 16.5 0 0 1-8.43-2.32l-.6-.36-6.17 1.62.96-6-.39-.63A16.6 16.6 0 1 1 24 40.6zm9.1-12.4c-.5-.25-2.93-1.45-3.38-1.61-.46-.17-.79-.25-1.13.25s-1.3 1.61-1.59 1.95c-.29.33-.58.37-1.08.12-.5-.25-2.1-.77-4-2.47-1.48-1.32-2.47-2.95-2.76-3.45-.29-.5-.03-.76.22-1.01.22-.22.5-.58.75-.87.25-.29.33-.5.5-.83.17-.33.08-.62-.04-.87-.12-.25-1.13-2.71-1.54-3.71-.4-.97-.82-.84-1.13-.85h-.96c-.33 0-.87.12-1.33 1.04 0 0-1.5 1.87-1.5 4.55 0 2.68 1.54 5.28 1.75 5.64.21.37 3.04 4.63 7.37 6.5 1.03.44 1.83.7 2.46.9.03.01.06.01.09.02 1.03.32 1.97.28 2.71.17.83-.12 2.55-.96 2.91-1.88.37-.92.37-1.71.25-1.88-.12-.17-.42-.29-.92-.54z"/>
        </svg>
      </div>
    </a>
  );

  // Porta o botão direto ao body — escapa de qualquer overflow/stacking context
  return createPortal(fab, document.body);
}

function AppInner() {
  const [view, setView] = useState<View>('site');
  const [totalInscritos, setTotalInscritos] = useState(842);
  const [temPixPendente, setTemPixPendente] = useState(false);

  // Detecta PIX pendente no localStorage para exibir banner no site
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pixId = urlParams.get('pix');
    if (pixId) {
      // Abre direto no fluxo de inscrição; o RegisterFlow vai detectar o ?pix= na URL
      setView('register');
      return;
    }
    try {
      const local = localStorage.getItem('inorun_pix_pendente');
      if (local) setTemPixPendente(true);
    } catch { /* ignore */ }
  }, []);

  return (
    <>
      <div className="min-h-screen bg-brand-bg">
        {view === 'site' && (
          <>
            {/* Banner PIX pendente */}
            {temPixPendente && (
              <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
                background: 'linear-gradient(90deg, #f97316, #ea580c)',
                color: '#fff', padding: '10px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '12px', fontSize: '14px', fontWeight: 600,
                boxShadow: '0 2px 12px rgba(249,115,22,0.4)',
              }}>
                <span>⏳ Você tem uma inscrição aguardando o comprovante do Pix!</span>
                <button
                  id="btn-retomar-pix"
                  onClick={() => setView('register')}
                  style={{
                    background: '#fff', color: '#ea580c', border: 'none',
                    borderRadius: '8px', padding: '6px 14px', fontWeight: 700,
                    fontSize: '13px', cursor: 'pointer',
                  }}>
                  Retomar inscrição →
                </button>
                <button
                  onClick={() => { try { localStorage.removeItem('inorun_pix_pendente'); } catch {} setTemPixPendente(false); }}
                  style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}
                  aria-label="Fechar">✕</button>
              </div>
            )}
            <PublicSite
              totalInscritos={totalInscritos}
              onRegister={() => setView('register')}
              onRegisterGrupo={() => setView('grupo')}
              onAdmin={() => setView('admin')}
            />
          </>
        )}
        {view === 'register' && (
          <RegisterFlow
            onBack={() => setView('site')}
            onDone={() => {
              setTotalInscritos(n => n + 1);
              setView('site');
            }}
          />
        )}
        {view === 'grupo' && (
          <GroupRegisterFlow
            onBack={() => setView('site')}
            onDone={() => setView('site')}
          />
        )}
        {view === 'admin' && (
          <AdminPanel
            totalInscritos={totalInscritos}
            onBack={() => setView('site')}
          />
        )}

        {/* Crédito global — Always Profit (todas as telas) */}
        <div className="bg-white border-t border-brand-lilac-mid py-4 px-5 text-center text-[12px] text-brand-muted">
          Feito com amor <span aria-hidden>❤️</span> por{' '}
          <span className="font-semibold text-brand-ink">Always Profit</span>
          {' · '}Contato:{' '}
          <a href="https://wa.me/5548996459791" target="_blank" rel="noopener noreferrer"
            className="text-brand-purple font-medium hover:underline">(48) 99645-9791</a>
        </div>
      </div>

      {/* WhatsApp FAB via portal — garante visibilidade em qualquer contexto */}
      <WhatsAppFAB />
    </>
  );
}

export default function App() {
  const isDev = import.meta.env.DEV;
  return (
    <BrowserRouter>
      <Routes>
        {isDev && <Route path="/dev/handshake" element={<DevHandshake />} />}
        <Route path="*" element={<AppInner />} />
      </Routes>
    </BrowserRouter>
  );
}
