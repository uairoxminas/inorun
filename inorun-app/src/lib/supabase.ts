// src/lib/supabase.ts
// Layer 2 — Cliente Supabase singleton
// As chaves são lidas de variáveis de ambiente (.env.local)

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || supabaseUrl.includes('xxxxxxxxxxxx')) {
  console.warn(
    '⚠️  VITE_SUPABASE_URL não configurada. Crie .env.local com suas credenciais do Supabase.'
  );
}

if (!supabaseAnonKey || supabaseAnonKey.includes('sua-chave')) {
  console.warn(
    '⚠️  VITE_SUPABASE_ANON_KEY não configurada. Crie .env.local com suas credenciais do Supabase.'
  );
}

export const supabase = createClient(supabaseUrl || 'http://placeholder', supabaseAnonKey || 'placeholder');
