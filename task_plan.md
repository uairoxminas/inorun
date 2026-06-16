# task_plan.md — INO RUN 2026

Status global: **Phase 2 (Link) — Blueprint APROVADO ✅ em 15/06/2026.**

---

## Protocol 0 — Initialization ✅
- [x] Criar `task_plan.md`, `findings.md`, `progress.md`
- [x] Inicializar `gemini.md` (constituição + schema proposto)
- [x] HALT: nada de código de produção até Discovery + Schema confirmados + Blueprint aprovado

## Phase 1 — B · Blueprint (Vision & Logic) ✅ APROVADO
- [x] **Discovery:** 5 perguntas respondidas (15/06/2026)
  - Preços e lotes por prova ✅
  - Faixas etárias oficiais ✅
  - Gateway: a definir na Phase 2
  - Inscrição em grupo: SIM · Cupons: SIM · Kits extras: a definir · Parcelamento: a definir
  - Local confirmado: Paraopeba – MG ✅ · Logo: a enviar
- [x] **Data-First:** JSON Data Schema confirmado em `gemini.md` (seção 4) ✅
- [x] **Research:** plataformas de referência + identidade visual da marca (ver `findings.md`)
- [x] **Blueprint APROVADO** → código liberado ✅

## Phase 2 — L · Link (Connectivity) ⏳ EM ANDAMENTO
- [ ] Criar projeto Supabase + chaves no `.env`
- [ ] Handshake Supabase (ler/escrever numa tabela de teste)
- [ ] Escolher gateway de pagamento (Mercado Pago / Pagar.me / Asaas)
- [ ] Conta no gateway de pagamento + handshake (criar cobrança Pix de teste em sandbox)
- [ ] Confirmar recebimento de webhook em ambiente de teste

## Phase 3 — A · Architect (3-Layer Build)
- [ ] Layer 1: SOPs em `architecture/` (inscricao.md, pagamento.md, lotes.md, categorias.md)
- [ ] Layer 3: migrations SQL (tabelas da seção 4 do gemini.md) + RLS
- [ ] Layer 3: módulos puros — `calcCategoria`, `validaCPF`, `precoLoteAtual`, `geraBib`
- [ ] Layer 3: Edge Function `webhook-pagamento` (idempotente)
- [ ] Layer 2: serviços do front conectando UI → Supabase (substituir mock)
- [ ] Suporte a inscrição em grupo (múltiplos atletas)
- [ ] Sistema de cupons de desconto

## Phase 4 — S · Stylize (Refinement & UI)
- [x] Protótipo visual navegável (InoRun.jsx) com identidade real da marca
- [ ] Plugar dados reais no lugar do mock
- [ ] Refino final de UI + estados de erro/vazio + responsivo
- [ ] Apresentar para feedback antes do deploy

## Phase 5 — T · Trigger (Deployment)
- [ ] Deploy front (Vercel/Netlify) + Supabase em produção
- [ ] Triggers: webhook de pagamento em produção, e-mail de confirmação
- [ ] Maintenance Log em `gemini.md`

---

### Bloqueadores / pendências de decisão
- Gateway de pagamento (Mercado Pago vs Pagar.me vs Asaas) — definir na Phase 2.
- Número de parcelas no cartão — a definir.
- Kits extras pagos — opcional, a definir.
- Logo oficial em SVG/PNG — a enviar pelo organizador.
- Preço da taxa por inscrição (plataforma cobra % ou valor fixo?) — a definir.
