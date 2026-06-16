# SOP: Lotes e Preços — INO RUN 2026

**Layer:** 1 — Architecture  
**Arquivo:** `src/lib/precoLoteAtual.ts`  
**Última atualização:** 2026-06-15

---

## Objetivo

Determinar o lote vigente e o preço correto no momento da inscrição.

## Regra Invariante

> O preço é **calculado no servidor** no momento da criação da inscrição.  
> O front-end **nunca define preço**. Exibe apenas o preço informativo para UX.

## Lotes Oficiais (confirmados em 15/06/2026)

### 5 km

| Lote   | Preço   | Período |
|--------|---------|---------|
| Lote 1 | R$79,00 | Abertura até 31/07/2026 |
| Lote 2 | R$89,00 | 01/08/2026 até 30/09/2026 |
| Lote 3 | R$99,00 | 01/10/2026 até 10/10/2026 |

### 10 km

| Lote   | Preço    | Período |
|--------|----------|---------|
| Lote 1 | R$99,00  | Abertura até 31/07/2026 |
| Lote 2 | R$109,00 | 01/08/2026 até 30/09/2026 |
| Lote 3 | R$119,00 | 01/10/2026 até 10/10/2026 |

> ⚠️ Inscrições encerram em 10/10/2026. O evento é em 11/10/2026.

## Algoritmo

1. Receber `prova` ('5km' | '10km') e `dataAtual`
2. Percorrer lotes em ordem crescente
3. Retornar o primeiro lote onde `dataAtual >= abre_em && dataAtual <= fecha_em`
4. Se nenhum lote estiver ativo → retornar `null` (inscrições encerradas)

## Pendências

- Data de abertura do Lote 1: confirmar a data exata de abertura das inscrições (atualmente configurado como 01/01/2026, ajustar quando definido)

## Testes

Execute `testPrecoLoteAtual()` no console do browser na rota `/dev/handshake`.
