// supabase/functions/verify-pix-receipt/index.ts
// Edge Function: verifica comprovante Pix com Gemini Vision e envia email via Resend
// Secrets necessarios no Supabase Dashboard:
//   GEMINI_API_KEY  — chave do Google AI Studio
//   RESEND_API_KEY  — chave do Resend

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY  = Deno.env.get("GEMINI_API_KEY")!;
const RESEND_API_KEY  = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const VALOR_ESPERADO_DISPLAY = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-user-token",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const {
      registration_id,
      valor_centavos,
      atleta_email,
      atleta_nome,
      prova_label,
      categoria,
      imagem_base64,
      mime_type,
    } = await req.json();

    if (!registration_id || !imagem_base64) {
      return jsonResponse({ aprovado: false, motivo: "Dados incompletos." }, 400);
    }

    // ══════════════════════════════════════════════════════
    // ⚠️  MODO TESTE — REMOVER ANTES DE IR PARA PRODUCAO
    // Bypassa o Gemini e aprova qualquer comprovante
    // ══════════════════════════════════════════════════════
    const MODO_TESTE = true; // mudar para false para reativar Gemini
    let analise = { aprovado: true, motivo: "Comprovante aprovado (modo teste)!" };

    if (!MODO_TESTE) {
    // ── 1. ANALISAR COMPROVANTE COM GEMINI VISION ──────────────────────────
    const valorDisplay = VALOR_ESPERADO_DISPLAY(valor_centavos);
    const prompt = `
Voce e um sistema de verificacao de comprovantes Pix para o evento esportivo INO RUN 2026.

Analise esta imagem e responda em JSON com o seguinte formato:
{
  "aprovado": true|false,
  "motivo": "explicacao em portugues (max 120 chars)",
  "valor_identificado": "valor em reais que aparece no comprovante ou null",
  "tipo_transferencia": "pix|ted|doc|outro|nao_identificado"
}

Regras de aprovacao (TODAS devem ser satisfeitas):
1. A imagem deve ser um comprovante de pagamento Pix real (nao simulacao, nao print de tela sem dados)
2. O valor pago deve ser EXATAMENTE R$ ${valorDisplay} (tolerancia de R$ 0,01 para arredondamento)
3. O status deve ser "Concluido", "Pago", "Aprovado" ou equivalente — NAO pendente ou agendado
4. O beneficiario pode ser "ANA CRISTINA CORREA GOMES" ou CNPJ 51.950.403/0001-32

Se qualquer regra for violada, retorne aprovado=false com o motivo especifico.
Seja objetivo. Nao aprove comprovantes duvidosos ou parcialmente visiveis.
`.trim();

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mime_type || "image/jpeg", data: imagem_base64 } },
            ],
          }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
            maxOutputTokens: 256,
          },
        }),
      }
    );

    if (!geminiResp.ok) {
      const gemErr = await geminiResp.text();
      console.error("Gemini error:", gemErr);
      return jsonResponse({ aprovado: false, motivo: "Nao foi possivel analisar a imagem. Envie uma foto clara do comprovante em JPG ou PNG." }, 200);
    }

    const geminiData = await geminiResp.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    try {
      analise = JSON.parse(rawText);
    } catch {
      analise = { aprovado: false, motivo: "Imagem nao reconhecida. Envie uma foto clara do comprovante Pix em JPG ou PNG." };
    }
    } // fim if (!MODO_TESTE)

    // ── 2. SE REPROVADO: retorna motivo ────────────────────────────────────
    if (!analise.aprovado) {
      return jsonResponse({ aprovado: false, motivo: analise.motivo }, 200);
    }


    // ── 3. SE APROVADO: confirma inscricao no banco ────────────────────────
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

    const { data: confirmacao, error: confErr } = await supabase
      .rpc("confirmar_inscricao_pix", { p_registration_id: registration_id });

    if (confErr || confirmacao?.error) {
      console.error("Confirm error:", confErr || confirmacao?.error);
      // Erro real de banco — retorna 200 com mensagem amigavel
      return jsonResponse({ aprovado: false, motivo: "Erro interno ao confirmar inscricao. Entre em contato: inscricoes@inorun.com.br" }, 200);
    }

    const bib_number = confirmacao.bib_number as number;

    // Salva analise do Gemini
    await supabase.from("pix_receipt").insert({
      registration_id,
      gemini_resultado: "aprovado",
      gemini_motivo:    analise.motivo,
      gemini_raw:       analise,
    });

    // ── 4. ENVIAR EMAIL VIA RESEND ─────────────────────────────────────────
    const emailHtml = buildEmailHtml(atleta_nome, bib_number, prova_label, categoria, valorDisplay);

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Inscricoes INO RUN <inscricoes@inorun.com.br>",
        to: [atleta_email],
        subject: `#${bib_number} confirmado! Sua inscricao INO RUN 2026 esta garantida`,
        html: emailHtml,
      }),
    });

    if (!resendResp.ok) {
      const resErr = await resendResp.text();
      console.error("Resend error:", resErr);
      // Email falhou mas inscricao ja foi confirmada — nao retornar erro
    }

    return jsonResponse({ aprovado: true, bib_number, motivo: "Comprovante aprovado!" }, 200);

  } catch (e) {
    console.error("Unhandled error:", e);
    return jsonResponse({ aprovado: false, motivo: "Erro interno. Tente novamente." }, 500);
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function buildEmailHtml(nome: string, bib: number, prova: string, categoria: string, valor: string): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(109,40,217,.12)">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:40px 32px;text-align:center">
      <div style="font-size:13px;font-weight:700;letter-spacing:3px;color:rgba(255,255,255,.7);text-transform:uppercase;margin-bottom:8px">
        CORRIDA INOLIVE · PARAOPEBA – MG
      </div>
      <div style="font-size:36px;font-weight:900;font-style:italic;color:#fff;letter-spacing:-1px;text-transform:uppercase">
        INO RUN 2026
      </div>
      <div style="font-size:13px;color:rgba(255,255,255,.75);margin-top:6px">11 de outubro de 2026</div>
    </div>

    <!-- Numero de peito destaque -->
    <div style="background:#fdf4ff;border-bottom:2px solid #ede9fe;padding:32px;text-align:center">
      <div style="font-size:13px;color:#7c3aed;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">
        SEU NUMERO DE PEITO
      </div>
      <div style="font-size:64px;font-weight:900;font-style:italic;color:#6d28d9;line-height:1;letter-spacing:-2px">
        #${bib}
      </div>
      <div style="font-size:13px;color:#8b5cf6;margin-top:8px">Guarde este numero — e o seu!</div>
    </div>

    <!-- Detalhes -->
    <div style="padding:32px">
      <p style="font-size:16px;color:#1e1b4b;margin:0 0 24px">
        Ola, <strong>${nome}</strong>! Sua inscricao foi <strong style="color:#16a34a">confirmada</strong>. Nos vemos em outubro!
      </p>

      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${row("Atleta", nome)}
        ${row("Prova", prova)}
        ${row("Categoria", categoria)}
        ${row("Numero de peito", `#${bib}`)}
        ${row("Valor pago", valor)}
        ${row("Metodo", "Pix")}
        ${row("Data da prova", "11/10/2026 — 07h00")}
        ${row("Local", "Paraopeba – MG")}
      </table>

      <div style="margin-top:28px;padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;font-size:13px;color:#166534">
        Um email de confirmacao foi enviado para o endereco informado no cadastro.
        Em caso de duvidas: <a href="mailto:inscricoes@inorun.com.br" style="color:#16a34a">inscricoes@inorun.com.br</a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#fdf4ff;border-top:1px solid #ede9fe;padding:20px 32px;text-align:center;font-size:12px;color:#8b5cf6">
      INO RUN 2026 — Corrida InoLive &copy; Paraopeba – MG<br>
      <a href="https://inorun.com.br" style="color:#7c3aed">inorun.com.br</a>
    </div>
  </div>
</body>
</html>`;
}

function row(label: string, value: string): string {
  return `
  <tr>
    <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-weight:500;width:45%">${label}</td>
    <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#1e1b4b;font-weight:700;text-align:right">${value}</td>
  </tr>`;
}
