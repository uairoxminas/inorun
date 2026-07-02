// src/App.tsx — INO RUN 2026
// 3 views: site público | fluxo de inscrição | painel do organizador

import './index.css';
import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PublicSite from './pages/PublicSite';
import RegisterFlow from './pages/RegisterFlow';
import GroupRegisterFlow from './pages/GroupRegisterFlow';
import AdminPanel from './pages/AdminPanel';
import DevHandshake from './pages/DevHandshake';

type View = 'site' | 'register' | 'grupo' | 'admin';

function AppInner() {
  const [view, setView] = useState<View>('site');
  const [totalInscritos, setTotalInscritos] = useState(842);

  return (
    <div className="min-h-screen bg-brand-bg">
      {view === 'site' && (
        <PublicSite
          totalInscritos={totalInscritos}
          onRegister={() => setView('register')}
          onRegisterGrupo={() => setView('grupo')}
          onAdmin={() => setView('admin')}
        />
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
    </div>
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
