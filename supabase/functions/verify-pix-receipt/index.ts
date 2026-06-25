// supabase/functions/verify-pix-receipt/index.ts
// Edge Function: verifica comprovante Pix com Gemini Vision
// Duplo caminho: aprovado → confirma; reprovado → em_analise + email 1
// Secrets: GEMINI_API_KEY, RESEND_API_KEY

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY   = Deno.env.get("GEMINI_API_KEY")!;
const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const fmt = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-user-token",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const {
      registration_id, valor_centavos, atleta_email, atleta_nome,
      prova_label, categoria, imagem_base64, mime_type,
    } = await req.json();

    if (!registration_id || !imagem_base64) {
      return json({ aprovado: false, motivo: "Dados incompletos." }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

    // ── 1. SALVAR COMPROVANTE NO STORAGE (sempre, antes da análise) ──────
    let comprovante_url: string | null = null;
    try {
      const ext = mime_type?.includes("png") ? "png" : mime_type?.includes("webp") ? "webp" : "jpg";
      const path = `${registration_id}/comprovante_${Date.now()}.${ext}`;
      const bytes = Uint8Array.from(atob(imagem_base64), c => c.charCodeAt(0));
      const { error: upErr } = await supabase.storage
        .from("comprovantes")
        .upload(path, bytes, { contentType: mime_type || "image/jpeg", upsert: true });
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("comprovantes").getPublicUrl(path);
        comprovante_url = urlData?.publicUrl ?? null;
      } else {
        console.error("Storage upload error:", upErr);
      }
    } catch (e) {
      console.error("Storage error:", e);
    }

    // ── 2. ANALISAR COM GEMINI VISION ────────────────────────────────────
    const valorDisplay = fmt(valor_centavos);
    const prompt = `
Voce e um sistema de verificacao de comprovantes Pix para o evento INO RUN 2026.

Analise a imagem e responda SOMENTE em JSON:
{
  "aprovado": true|false,
  "motivo": "explicacao curta em portugues (max 120 chars)",
  "valor_identificado": "valor no comprovante ou null",
  "tipo_transferencia": "pix|ted|doc|outro|nao_identificado"
}

Regras (TODAS devem ser satisfeitas para aprovado=true):
1. Imagem e comprovante de Pix real (nao simulacao)
2. Valor EXATAMENTE ${valorDisplay} (tolerancia R$0,01)
3. Status: "Concluido", "Pago" ou "Aprovado" (nao pendente)
4. Beneficiario: "ANA CRISTINA CORREA GOMES" ou CNPJ 51.950.403/0001-32

Se qualquer regra falhar, aprovado=false com motivo especifico.
`.trim();

    let analise = { aprovado: false, motivo: "Nao foi possivel analisar. Comprovante enviado para revisao manual." };

    try {
      const geminiResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [
              { text: prompt },
              { inline_data: { mime_type: mime_type || "image/jpeg", data: imagem_base64 } },
            ]}],
            generationConfig: { responseMimeType: "application/json", temperature: 0.1, maxOutputTokens: 256 },
          }),
        }
      );
      if (geminiResp.ok) {
        const gd = await geminiResp.json();
        const rawText = gd.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
        analise = JSON.parse(rawText);
      }
    } catch (e) {
      console.error("Gemini error:", e);
    }

    // Salva análise na tabela pix_receipt
    await supabase.from("pix_receipt").upsert({
      registration_id,
      gemini_resultado: analise.aprovado ? "aprovado" : "reprovado",
      gemini_motivo:    analise.motivo,
      gemini_raw:       analise,
      comprovante_url,
      comprovante_mime: mime_type,
      em_analise:       !analise.aprovado,
    }, { onConflict: "registration_id" });

    // ── 3A. GEMINI APROVOU → confirma imediatamente ──────────────────────
    if (analise.aprovado) {
      const { data: conf, error: confErr } = await supabase
        .rpc("confirmar_inscricao_pix", { p_registration_id: registration_id });

      if (confErr || conf?.error) {
        console.error("Confirm error:", confErr || conf?.error);
        return json({ aprovado: false, em_analise: false, motivo: "Erro ao confirmar. Contate: inscricoes@inorun.com.br" }, 200);
      }

      const bib_number = conf.bib_number as number;

      // Email de confirmação
      await sendEmail(atleta_email,
        `#${bib_number} confirmado! Sua inscrição INO RUN 2026 está garantida`,
        emailConfirmado(atleta_nome, bib_number, prova_label, categoria, valorDisplay)
      );

      return json({ aprovado: true, em_analise: false, bib_number, motivo: "Comprovante aprovado!" }, 200);
    }

    // ── 3B. GEMINI REPROVOU → status em_analise ──────────────────────────
    await supabase.from("registration")
      .update({ status: "em_analise", updated_at: new Date().toISOString() })
      .eq("id", registration_id);

    // Email 1 — "aguardando verificação"
    await sendEmail(atleta_email,
      "Comprovante recebido — INO RUN 2026 aguardando verificação",
      emailEmAnalise(atleta_nome, prova_label, valorDisplay)
    );

    return json({
      aprovado: false,
      em_analise: true,
      motivo: analise.motivo,
    }, 200);

  } catch (e) {
    console.error("Unhandled error:", e);
    return json({ aprovado: false, em_analise: false, motivo: "Erro interno. Contate: inscricoes@inorun.com.br" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function sendEmail(to: string, subject: string, html: string) {
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Inscricoes INO RUN <inscricoes@inorun.com.br>", to: [to], subject, html }),
    });
    if (!r.ok) console.error("Resend error:", await r.text());
  } catch (e) { console.error("Email error:", e); }
}

// ── Templates de email ────────────────────────────────────────────────────────

function emailConfirmado(nome: string, bib: number, prova: string, categoria: string, valor: string): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;background:#f5f3ff;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(109,40,217,.12)">
  <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:40px 32px;text-align:center">
    <div style="font-size:13px;font-weight:700;letter-spacing:3px;color:rgba(255,255,255,.7);text-transform:uppercase;margin-bottom:8px">CORRIDA INOLIVE · PARAOPEBA – MG</div>
    <div style="font-size:36px;font-weight:900;font-style:italic;color:#fff;text-transform:uppercase">INO RUN 2026</div>
    <div style="font-size:13px;color:rgba(255,255,255,.75);margin-top:6px">11 de outubro de 2026</div>
  </div>
  <div style="padding:32px">
    <p style="font-size:16px;color:#1e1b4b;margin:0 0 24px">
      Olá, <strong>${nome}</strong>! Sua inscrição foi <strong style="color:#16a34a">confirmada</strong>. Nos vemos em outubro! 🎉
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${row("Atleta", nome)}${row("Prova", prova)}${row("Categoria", categoria)}
      ${row("Número de peito", `#${bib}`)}${row("Valor pago", valor)}${row("Método", "Pix")}
      ${row("Data", "11/10/2026 — 07h00")}${row("Local", "Paraopeba – MG")}
    </table>
    <div style="margin-top:24px;padding:14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;font-size:13px;color:#166534">
      Dúvidas: <a href="mailto:inscricoes@inorun.com.br" style="color:#16a34a">inscricoes@inorun.com.br</a>
    </div>
  </div>
  <div style="background:#fdf4ff;border-top:1px solid #ede9fe;padding:16px 32px;text-align:center;font-size:12px;color:#8b5cf6">
    INO RUN 2026 — <a href="https://inorun.com.br" style="color:#7c3aed">inorun.com.br</a>
  </div>
</div></body></html>`;
}

function emailEmAnalise(nome: string, prova: string, valor: string): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;background:#f5f3ff;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(109,40,217,.12)">
  <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:40px 32px;text-align:center">
    <div style="font-size:13px;font-weight:700;letter-spacing:3px;color:rgba(255,255,255,.7);text-transform:uppercase;margin-bottom:8px">CORRIDA INOLIVE · PARAOPEBA – MG</div>
    <div style="font-size:36px;font-weight:900;font-style:italic;color:#fff;text-transform:uppercase">INO RUN 2026</div>
  </div>
  <div style="padding:32px">
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:48px">⏳</div>
      <h2 style="font-size:24px;font-weight:900;font-style:italic;color:#7c3aed;text-transform:uppercase;margin:8px 0">Comprovante Recebido!</h2>
    </div>
    <p style="font-size:15px;color:#1e1b4b;margin:0 0 16px">
      Olá, <strong>${nome}</strong>! Recebemos seu comprovante de pagamento para a inscrição na <strong>${prova}</strong>.
    </p>
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:12px;padding:16px;font-size:13px;color:#92400e;margin-bottom:16px">
      <strong>⚠️ Verificação em andamento</strong><br>
      Nossa equipe irá analisar seu comprovante em até <strong>24 horas</strong>. 
      Você receberá um novo email com a confirmação da sua inscrição.
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${row("Atleta", nome)}${row("Prova", prova)}
      ${row("Valor", valor)}${row("Data da prova", "11/10/2026 — 07h00")}
    </table>
    <div style="margin-top:24px;padding:14px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;font-size:13px;color:#075985">
      Dúvidas? <a href="mailto:inscricoes@inorun.com.br" style="color:#0284c7">inscricoes@inorun.com.br</a>
    </div>
  </div>
  <div style="background:#fdf4ff;border-top:1px solid #ede9fe;padding:16px 32px;text-align:center;font-size:12px;color:#8b5cf6">
    INO RUN 2026 — <a href="https://inorun.com.br" style="color:#7c3aed">inorun.com.br</a>
  </div>
</div></body></html>`;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:9px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-weight:500;width:45%">${label}</td>
    <td style="padding:9px 0;border-bottom:1px solid #f3f4f6;color:#1e1b4b;font-weight:700;text-align:right">${value}</td>
  </tr>`;
}
