# findings.md — INO RUN 2026

## Pesquisa: plataformas de inscrição de corrida (referência)

- **RunSignup** (EUA, padrão-ouro): site dinâmico sincronizado com o painel — preço por lote ao vivo, contador de inscritos, contagem regressiva, leaderboards, galeria, termômetro de doação. Wizard de criação rápida. Gratuito p/ organizador, taxa por inscrição. → **Copiar:** componentes dinâmicos sincronizados (sensação de evento grande).
- **ACTIVE / Active.com:** checkout robusto multisport, descoberta. → Copiar: rigor do checkout.
- **Race Roster / EnMotive:** CRM, voluntários, fundraising, lotes, times. → Copiar: lotes, cupons, equipes.
- **Ticket Sports** (líder BR, 20+ anos): regras locais do esporte — dados completos do atleta obrigatórios, plataforma específica para eventos esportivos. → Copiar: Pix, CPF, categoria por idade/sexo, kit/camiseta, retirada de kit.
- **Doity** (BR, self-service): site do evento, check-in/credenciamento, certificados. → Copiar: certificado automático, check-in por QR.

**Síntese:** vitrine dinâmica (RunSignup) + checkout sólido (ACTIVE) + lotes/cupons/equipes (Race Roster) + camada local Pix/CPF/categorias (Ticket Sports) + check-in/certificado (Doity).

## Identidade visual da marca (extraída do Canva — design "INORUN - 2026", id DAHGThc6ebU)

- **Cores:** roxo vibrante primário (~#8417AE), roxo escuro (~#5B0E7A), roxo médio (~#A93FD0), **amarelo vibrante de acento (~#FFD200)** — usado na forma orgânica lateral da capa e em destaques, dando alegria à identidade —, branco e lilás suave de fundo. Tema **claro** (branco), não escuro. A marca é roxo+amarelo, não só roxo.
- **Logo:** "INO RUN" bold itálico dinâmico; subtítulo "Corrida InoLive". O "O" tem tratamento de anel — exportar SVG oficial do Canva para fidelidade.
- **Cards (estilo deck):** fundo branco, header roxo com ícone circular branco, corpo em cinza.
- **Tipografia:** títulos em itálico bold (capturado com Saira Condensed italic no protótipo); corpo sans (Inter).
- **Fotos:** corredores com camiseta roxa da marca.

## Conteúdo real do evento (do deck de patrocínio)

- **Local:** Paraopeba – MG ✅ (confirmado — "PARAPEOPA" no deck era erro tipográfico).
- **Data:** 11/10/2026.
- **Provas:** **5 km** (iniciante; "percurso rápido e dinâmico… sentir a energia da linha de chegada") e **10 km** (performance; "quebrar recordes pessoais (PRs) e elevar o nível").
- **Categorias:** Individual masculino e feminino, premiação por **faixa etária**.
- **Público-alvo (deck):** 20–50 anos; 45% homens / 55% mulheres.
- **Cotas de patrocínio (B2B, NÃO são preço de inscrição):** Naming R$5.000 · Master R$3.000 (2 cotas) · Expositor R$1.000 (5 cotas).

## ✅ DISCOVERY CONFIRMADO — 15/06/2026

### Preços e Lotes (CONFIRMADOS)

| Prova | Lote | Preço | Período |
|---|---|---|---|
| 5 km | Lote 1 | R$79,00 | até 31/07/2026 |
| 5 km | Lote 2 | R$89,00 | até 30/09/2026 |
| 5 km | Lote 3 | R$99,00 | até 10/10/2026 |
| 10 km | Lote 1 | R$99,00 | até 31/07/2026 |
| 10 km | Lote 2 | R$109,00 | até 30/09/2026 |
| 10 km | Lote 3 | R$119,00 | até 10/10/2026 |

### Faixas Etárias Oficiais (CONFIRMADAS — base: idade em 11/10/2026)

Sub-20 · 20-24 · 25-29 · 30-34 · 35-39 · 40-44 · 45-49 · 50+
(separadas por sexo: M e F → total de 16 categorias de premiação por prova)

### Funcionalidades (CONFIRMADAS)

- **Inscrição em equipe/grupo:** ✅ SIM
- **Kits extras pagos (camiseta adicional, etc):** ⏳ Opcional — a definir
- **Parcelamento no cartão:** ⏳ A definir (número de parcelas pendente)
- **Cupons de desconto:** ✅ SIM

### Gateway de Pagamento

- ⏳ A definir (Mercado Pago / Pagar.me / Asaas) — Phase 2 Link

### Logo

- ✅ Logo oficial SVG recebida e salva em `INORUN LOGO.svg` (274KB, SVG com imagem embutida)
- Arquivo pronto para uso no projeto React (importar como asset)

## Constraints técnicas / de mercado (BR)

- **Pix** é essencial e esperado (confirmação automática via webhook).
- **CPF** obrigatório; usar como chave de unicidade por evento.
- **Cartão** com parcelamento — número de parcelas a definir.
- **LGPD:** proteger CPF e contato de emergência (RLS no Supabase).
- Categoria por faixa etária calculada na **data da prova** (11/10/2026), não na data da inscrição.
- **Inscrição em grupo:** suporte a múltiplos atletas numa mesma sessão de compra.
