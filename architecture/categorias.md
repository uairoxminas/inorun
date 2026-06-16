# SOP: Cálculo de Categoria — INO RUN 2026

**Layer:** 1 — Architecture  
**Arquivo:** `src/lib/calcCategoria.ts`  
**Última atualização:** 2026-06-15

---

## Objetivo

Calcular a categoria oficial de premiação de um atleta com base em:
- Sexo (`M` ou `F`)
- Idade **na data da prova** (11/10/2026)

## Regra Invariante

> A categoria é **derivada**, nunca digitada pelo atleta.  
> O cálculo usa a data da prova como referência, **não** a data de inscrição.

## Faixas Etárias Oficiais (confirmadas em 15/06/2026)

| Faixa    | Idade mínima | Idade máxima |
|----------|-------------|-------------|
| Sub-20   | 0           | 19          |
| 20-24    | 20          | 24          |
| 25-29    | 25          | 29          |
| 30-34    | 30          | 34          |
| 35-39    | 35          | 39          |
| 40-44    | 40          | 44          |
| 45-49    | 45          | 49          |
| 50+      | 50          | ∞           |

Total: **16 categorias** (8 faixas × 2 sexos) por prova.

## Algoritmo

1. Calcular `anoProva - anoNascimento = idadeBruta`
2. Se o atleta ainda não fez aniversário até 11/10/2026 → `idadeNaProva = idadeBruta - 1`
3. Mapear `idadeNaProva` para a faixa correspondente
4. Retornar `"${sexo} ${faixa}"` — ex: `"M 30-34"`, `"F Sub-20"`

## Input / Output

```ts
calcCategoria(nascimento: Date, sexo: 'M' | 'F'): string
```

## Edge Cases

- Atleta que faz 20 anos **exatamente** em 11/10/2026 → categoria `20-24` ✅
- Atleta que faz 20 anos em 12/10/2026 → categoria `Sub-20` ✅ (ainda não fez 20 na prova)
- Atleta com 80 anos → categoria `50+` ✅

## Testes

Execute `testCalcCategoria()` no console do browser na rota `/dev/handshake`.
