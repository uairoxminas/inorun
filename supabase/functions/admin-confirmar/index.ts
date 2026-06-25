// supabase/functions/admin-confirmar/index.ts
// Edge Function: confirmação/rejeição manual de comprovante pelo admin
// Chama confirmar_inscricao_manual (RPC) + envia email ao atleta

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { registration_id, acao } = await req.json();

    if (!registration_id || !["confirmar", "rejeitar"].includes(acao)) {
      return json({ ok: false, error: "Dados inválidos" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

    // 1. Chama a função do banco
    const { data, error } = await supabase.rpc("confirmar_inscricao_manual", {
      p_registration_id: registration_id,
      p_acao: acao,
    });

    if (error || data?.error) {
      return json({ ok: false, error: error?.message || data?.error }, 200);
    }

    const bib_number: number | null = data?.bib_number ?? null;
    console.log("[admin-confirmar] RPC ok, bib_number:", bib_number);

    // 2. Busca dados do atleta para o email
    const { data: reg, error: regErr } = await supabase
      .from("vw_inscritos")
      .select("nome, email, prova, categoria, preco_centavos")
      .eq("registration_id", registration_id)
      .single();

    if (regErr || !reg) {
      console.error("[admin-confirmar] vw_inscritos falhou:", regErr?.message);
      return json({ ok: true, bib_number, email_sent: false }, 200);
    }

    const valor = (reg.preco_centavos / 100).toLocaleString("pt-BR", {
      style: "currency", currency: "BRL",
    });

    let email_sent = false;
    if (acao === "confirmar" && bib_number) {
      email_sent = await sendEmail(
        reg.email,
        `✅ Inscrição confirmada! INO RUN 2026 — ${reg.prova}`,
        emailConfirmado(reg.nome, bib_number, reg.prova, reg.categoria, valor)
      );
    } else if (acao === "rejeitar") {
      email_sent = await sendEmail(
        reg.email,
        "⚠️ Comprovante não aprovado — INO RUN 2026",
        emailRejeitado(reg.nome, reg.prova, valor)
      );
    }

    return json({ ok: true, bib_number, email_sent }, 200);

  } catch (e) {
    console.error("Unhandled error:", e);
    return json({ ok: false, error: "Erro interno" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    console.log("[admin-confirmar] Enviando email para:", to);
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Inscricoes INO RUN <inscricoes@inorun.com.br>",
        to: [to],
        subject,
        html,
      }),
    });
    const body = await r.text();
    if (!r.ok) {
      console.error("[admin-confirmar] Resend HTTP", r.status, ":", body);
      return false;
    }
    console.log("[admin-confirmar] Email enviado com sucesso:", body);
    return true;
  } catch (e) {
    console.error("[admin-confirmar] Excecao ao enviar email:", e);
    return false;
  }
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:9px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-weight:500;width:45%">${label}</td>
    <td style="padding:9px 0;border-bottom:1px solid #f3f4f6;color:#1e1b4b;font-weight:700;text-align:right">${value}</td>
  </tr>`;
}

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
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:48px">🎉</div>
      <h2 style="font-size:24px;font-weight:900;font-style:italic;color:#16a34a;text-transform:uppercase;margin:8px 0">Inscrição Confirmada!</h2>
    </div>
    <p style="font-size:16px;color:#1e1b4b;margin:0 0 24px">
      Olá, <strong>${nome}</strong>! Seu comprovante foi verificado e sua inscrição está <strong style="color:#16a34a">confirmada</strong>. Nos vemos em outubro! 🏃
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

function emailRejeitado(nome: string, prova: string, valor: string): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;background:#f5f3ff;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(109,40,217,.12)">
  <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:40px 32px;text-align:center">
    <div style="font-size:13px;font-weight:700;letter-spacing:3px;color:rgba(255,255,255,.7);text-transform:uppercase;margin-bottom:8px">CORRIDA INOLIVE · PARAOPEBA – MG</div>
    <div style="font-size:36px;font-weight:900;font-style:italic;color:#fff;text-transform:uppercase">INO RUN 2026</div>
  </div>
  <div style="padding:32px">
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:48px">⚠️</div>
      <h2 style="font-size:22px;font-weight:900;color:#dc2626;text-transform:uppercase;margin:8px 0">Comprovante Não Aprovado</h2>
    </div>
    <p style="font-size:15px;color:#1e1b4b;margin:0 0 16px">
      Olá, <strong>${nome}</strong>! Infelizmente não foi possível verificar seu comprovante de pagamento para a inscrição na <strong>${prova}</strong>.
    </p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;font-size:13px;color:#991b1b;margin-bottom:16px">
      <strong>O que fazer agora?</strong><br>
      Acesse o site e envie um novo comprovante, ou entre em contato conosco pelo email abaixo.
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${row("Atleta", nome)}${row("Prova", prova)}${row("Valor", valor)}
    </table>
    <div style="margin-top:24px;padding:14px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;font-size:13px;color:#075985">
      Contato: <a href="mailto:inscricoes@inorun.com.br" style="color:#0284c7">inscricoes@inorun.com.br</a>
    </div>
  </div>
  <div style="background:#fdf4ff;border-top:1px solid #ede9fe;padding:16px 32px;text-align:center;font-size:12px;color:#8b5cf6">
    INO RUN 2026 — <a href="https://inorun.com.br" style="color:#7c3aed">inorun.com.br</a>
  </div>
</div></body></html>`;
}
