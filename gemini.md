# gemini.md — Project Constitution · INO RUN 2026

> `gemini.md` é **lei**. Os arquivos de planejamento (`task_plan.md`, `findings.md`, `progress.md`) são **memória**.
> Só atualizar este arquivo quando: (1) um schema mudar, (2) uma regra for adicionada, (3) a arquitetura for modificada.

---

## 1. Identidade do projeto

- **Produto:** Site oficial + plataforma de inscrição da corrida **INO RUN 2026 — Corrida InoLive**.
- **Evento:** Paraopeba – MG · 11/10/2026 · provas de 5 km e 10 km.
- **Escopo (v1):** evento único, com 3 pilares — (a) site público, (b) fluxo de inscrição com pagamento, (c) painel do organizador.
- **System Pilot:** prioriza confiabilidade sobre velocidade; nunca adivinha business logic.

## 2. Stack

- Front-end: React 19 + Vite + Tailwind CSS (ambiente Antigravity).
- Back-end / Source of Truth: **Supabase** (Postgres + Auth + RLS + Edge Functions + Storage).
- Pagamento: gateway brasileiro com Pix nativo (Mercado Pago / Pagar.me / Asaas — A DEFINIR no Discovery).
- Entrega/Deploy: a definir (Vercel/Netlify para o front; Supabase para dados e funções).

## 3. Tradução das 3 camadas A.N.T. para este projeto

O protocolo nasceu para automações Python. Aqui a separação determinístico vs. probabilístico se mantém, traduzida:

| Camada | No B.L.A.S.T. original | Neste projeto (React + Supabase) |
|---|---|---|
| **Layer 1 — Architecture** | SOPs em `architecture/*.md` | SOPs em `architecture/*.md` (regras de inscrição, lotes, pagamento, categorias) |
| **Layer 2 — Navigation** | Reasoning que roteia dados | Serviços/orquestração no front (`src/services`, hooks) + roteamento de estado do fluxo |
| **Layer 3 — Tools** | Scripts Python atômicos em `tools/` | Lógica determinística atômica e testável: **Supabase Edge Functions** (webhook de pagamento, geração de bib) + **módulos puros** (`calcCategoria`, `validaCPF`, `precoLoteAtual`). SQL + RLS são parte desta camada. |

- `.env` → segredos (chaves Supabase service role, chave do gateway). Verificados na fase **Link**.
- `.tmp/` → intermediários efêmeros (ex.: payloads de teste de webhook).
- **Deliverable só está "Complete" quando os dados reais estiverem persistidos no Supabase** (não em mock).

## 4. Data Schema (PROPOSTO — a confirmar no Discovery)

> Coding de produção da camada de dados **não começa** até este shape ser confirmado.

```text
event            id, slug, nome, cidade, uf, data_prova (date), status
race (prova)     id, event_id→event, distancia_km, label, descricao, vagas_total
pricing_lot      id, race_id→race, nome, preco_centavos, abre_em, fecha_em, ordem, ativo (bool derivado)
category         id, sexo (M|F), faixa_min, faixa_max   # premiação por faixa etária
athlete          id, nome, cpf (unique), nascimento (date), sexo, email, telefone, contato_emergencia
registration     id, event_id, race_id, athlete_id, lot_id, category_id,
                 camiseta (PP|P|M|G|GG|XG), cupom_id?, bib_number?, status (pendente|confirmado|cancelado),
                 created_at
coupon           id, codigo (unique), tipo (percentual|fixo), valor, ativo, validade
payment          id, registration_id→registration, gateway, metodo (pix|cartao),
                 valor_centavos, status (criado|pago|falhou|estornado), gateway_ref, paid_at
```

**Shapes de payload-chave**

```jsonc
// INPUT — criar inscrição (front → Supabase)
{
  "race_id": "uuid",
  "athlete": { "nome": "", "cpf": "", "nascimento": "YYYY-MM-DD", "sexo": "M|F",
               "email": "", "telefone": "", "contato_emergencia": "" },
  "camiseta": "M",
  "cupom": "INO10|null"
}

// OUTPUT — inscrição criada (aguardando pagamento)
{
  "registration_id": "uuid",
  "lot": { "nome": "Lote 2 — Atual", "preco_centavos": 8900 },
  "category": "M 30-34",
  "total_centavos": 8010,
  "payment": { "metodo": "pix", "status": "criado", "pix_copia_cola": "..." }
}

// WEBHOOK — gateway → Edge Function (confirmação)
{ "gateway_ref": "...", "status": "pago", "paid_at": "ISO-8601" }
// efeito determinístico: registration.status = confirmado; gera bib_number sequencial
```

## 5. Behavioral rules / invariantes (law)

1. **Não adivinhar business logic.** Preço, lotes, categorias e valores vêm do organizador, nunca inventados.
2. **CPF é único por evento.** Bloquear inscrição duplicada do mesmo CPF na mesma prova.
3. **Categoria é derivada** de `sexo` + idade na data da prova (`calcCategoria`), nunca digitada pelo atleta.
4. **bib_number só é gerado após pagamento confirmado** (status = pago no webhook). Sequencial, sem buracos por evento.
5. **Preço do lote é calculado no servidor** no momento da criação da inscrição — o front nunca define preço.
6. **Idempotência do webhook:** o mesmo `gateway_ref` não pode confirmar duas vezes.
7. **LGPD:** dados pessoais (CPF, contato de emergência) protegidos por RLS; nunca expostos em endpoints públicos.
8. **Self-Annealing:** ao falhar uma tool/função, ler o erro, corrigir, testar e **atualizar o SOP em `architecture/`** para o erro não repetir.

## 6. Maintenance Log

- _(vazio — preencher na fase Trigger)_
