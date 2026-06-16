// src/pages/AdminLogin.tsx — Tela de login do painel do organizador
import { useState } from 'react';
import Logo from '../components/Logo';

const PASS_HASH = import.meta.env.VITE_ADMIN_PASS as string;

interface Props { onLogin: () => void; }

export default function AdminLogin({ onLogin }: Props) {
  const [senha, setSenha]   = useState('');
  const [erro, setErro]     = useState('');
  const [show, setShow]     = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (senha === PASS_HASH) {
      sessionStorage.setItem('admin_auth', 'ok');
      onLogin();
    } else {
      setErro('Senha incorreta');
      setSenha('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-brand flex items-center justify-center p-5">
      <div className="w-full max-w-[380px]">
        <div className="text-center mb-8">
          <Logo height={44} light />
          <p className="text-white/60 mt-3 text-[14px] tracking-[0.12em] uppercase">
            Painel do Organizador
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 shadow-brand-lg">
          <h1 className="font-display font-extrabold italic uppercase text-[28px] text-brand-ink leading-none mb-6">
            Acesso restrito
          </h1>

          <div>
            <label className="label">Senha do organizador</label>
            <div className="relative">
              <input
                id="input-senha-admin"
                type={show ? 'text' : 'password'}
                className={`input pr-12 ${erro ? 'border-red-400 focus:ring-red-400' : ''}`}
                value={senha}
                onChange={e => { setSenha(e.target.value); setErro(''); }}
                placeholder="••••••••••"
                autoFocus
              />
              <button type="button" onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-purple transition-colors text-[13px]">
                {show ? 'Ocultar' : 'Ver'}
              </button>
            </div>
            {erro && <p className="text-red-500 text-[12px] mt-1.5">{erro}</p>}
          </div>

          <button id="btn-entrar-admin" type="submit"
            className="btn-primary w-full mt-6 py-4 text-[17px]">
            Entrar no painel
          </button>

          <p className="text-center text-[12px] text-brand-muted mt-4">
            INO RUN 2026 · Acesso exclusivo ao organizador
          </p>
        </form>
      </div>
    </div>
  );
}
