# progress.md — INO RUN 2026

Registro cronológico de ações, resultados e erros.

---

## 2026-06-15 — Phase 1: Blueprint

### Concluído
- Discovery respondido (5 perguntas): preços, lotes, faixas etárias, funcionalidades, local, logo
- `findings.md` atualizado com todos os dados confirmados
- Logo oficial SVG recebida → salva em `INORUN LOGO.svg` (274KB)
- Blueprint aprovado ✅

---

## 2026-06-15 — Phase 2: Link — Scaffolding

### Concluído
- Projeto `inorun-app/` criado com `create-vite@latest --template react-ts`
- Dependências instaladas: React 19 + TypeScript + Vite + Supabase + Router + Forms + Tailwind v3
- Tailwind configurado com design tokens oficiais da marca (roxo/amarelo)
- `src/index.css` com design tokens, classes de componente base (Inter + Saira Condensed)
- `src/App.tsx` com React Router + rota `/dev/handshake` (só em DEV)

### Módulos Puros Criados (Layer 3)
- `src/lib/calcCategoria.ts` — cálculo de categoria por faixa etária + 11 testes inline
- `src/lib/validaCPF.ts` — validação CPF (algoritmo Receita Federal) + 11 testes inline
- `src/lib/precoLoteAtual.ts` — lotes/preços oficiais + 7 testes inline + formataBRL()

### Supabase + Handshake
- `src/lib/supabase.ts` — singleton com avisos de configuração pendente
- `.env.example` — template sem valores sensíveis
- `src/pages/DevHandshake.tsx` — UI para testar Supabase e módulos
- Rota de teste: `http://localhost:5173/dev/handshake`

### SOPs de Architecture
- `architecture/categorias.md` — regras de categoria por faixa etária
- `architecture/lotes.md` — preços e lotes oficiais

### Build e Servidor
- `npm run build` → ✅ 0 erros TypeScript, 0 warnings
- `npm run dev` → rodando em `http://localhost:5173`

### Pendente na Phase 2
- [x] .env.local criado com credenciais reais do Supabase
- [x] GitHub publicado: https://github.com/uairoxminas/inorun.git (branch master)
- [ ] Migration SQL da handshake_test executada no Supabase ← PRÓXIMO PASSO DO USUÁRIO
- [ ] Handshake testado em http://localhost:5173/dev/handshake
- [ ] Definir gateway de pagamento + handshake de sandbox

### Erros encontrados e corrigidos
- `DevHandshake.tsx` linha 120: `Type 'unknown' is not assignable to type 'ReactNode'`
  - Fix: tipagem de `data` → `Record<string, unknown>` ✅
