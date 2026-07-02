// supabase/functions/admin-confirmar-grupo/index.ts
// Edge Function: confirmação/rejeição de inscrição EM GRUPO pelo admin.
// Chama confirmar_grupo (RPC) e, ao confirmar:
//   - envia email de confirmação (com número de peito) a CADA atleta que tiver email cadastrado
//   - envia um resumo ao responsável do grupo
// Ao rejeitar: avisa o responsável.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRECO_GRUPO = 8900; // R$89 por atleta

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { group_id, acao } = await req.json();

    if (!group_id || !["confirmar", "rejeitar"].includes(acao)) {
      return json({ ok: false, error: "Dados inválidos" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

    // 1. Confirma/rejeita o grupo no banco (gera bibs, marca pagamentos)
    const { data, error } = await supabase.rpc("confirmar_grupo", {
      p_group_id: group_id,
      p_acao: acao,
    });

    if (error || data?.error) {
      return json({ ok: false, error: error?.message || data?.error }, 200);
    }

    // 2. Dados do grupo
    const { data: grupo } = await supabase
      .from("vw_grupos")
      .select("nome_grupo, responsavel_nome, responsavel_email, qtd_atletas, valor_total_centavos, confirmados")
      .eq("id", group_id)
      .single();

    let emails_enviados = 0;

    if (acao === "confirmar") {
      // 3. Atletas do grupo (para email individual com o bib de cada um)
      const { data: atletas } = await supabase
        .from("vw_grupo_atletas")
        .select("nome, email, prova, categoria, bib_number, status")
        .eq("group_id", group_id);

      const lista = (atletas ?? []).filter((a) => a.status === "confirmado");

      // 3a. Email para cada atleta COM email cadastrado
      for (const a of lista) {
        const to = (a.email ?? "").trim();
        if (!to) continue; // atleta sem email não recebe
        const valor = (PRECO_GRUPO / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        const ok = await sendEmail(
          to,
          `✅ Inscrição confirmada! INO RUN 2026 — ${a.prova}`,
          emailAtleta(a.nome, a.bib_number, a.prova, a.categoria, valor, grupo?.nome_grupo ?? "")
        );
        if (ok) emails_enviados++;
      }

      // 3b. Resumo para o responsável
      if (grupo?.responsavel_email) {
        const total = (grupo.valor_total_centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        const ok = await sendEmail(
          grupo.responsavel_email,
          `✅ Grupo confirmado! INO RUN 2026 — ${grupo.nome_grupo}`,
          emailResponsavel(grupo.responsavel_nome, grupo.nome_grupo, grupo.confirmados ?? lista.length, total, lista)
        );
        if (ok) emails_enviados++;
      }
    } else if (acao === "rejeitar") {
      if (grupo?.responsavel_email) {
        const ok = await sendEmail(
          grupo.responsavel_email,
          "⚠️ Inscrição de grupo não aprovada — INO RUN 2026",
          emailRejeitado(grupo.responsavel_nome, grupo.nome_grupo)
        );
        if (ok) emails_enviados++;
      }
    }

    return json({ ok: true, confirmados: data?.confirmados ?? null, emails_enviados }, 200);
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
      console.error("[admin-confirmar-grupo] Resend HTTP", r.status, ":", body);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[admin-confirmar-grupo] Excecao ao enviar email:", e);
    return false;
  }
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:9px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-weight:500;width:45%">${label}</td>
    <td style="padding:9px 0;border-bottom:1px solid #f3f4f6;color:#1e1b4b;font-weight:700;text-align:right">${value}</td>
  </tr>`;
}

function shell(inner: string): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;background:#f5f3ff;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(109,40,217,.12)">
  <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:40px 32px;text-align:center">
    <div style="font-size:13px;font-weight:700;letter-spacing:3px;color:rgba(255,255,255,.7);text-transform:uppercase;margin-bottom:8px">CORRIDA INOLIVE · PARAOPEBA – MG</div>
    <div style="font-size:36px;font-weight:900;font-style:italic;color:#fff;text-transform:uppercase">INO RUN 2026</div>
    <div style="font-size:13px;color:rgba(255,255,255,.75);margin-top:6px">11 de outubro de 2026</div>
  </div>
  <div style="padding:32px">${inner}</div>
  <div style="background:#fdf4ff;border-top:1px solid #ede9fe;padding:16px 32px;text-align:center;font-size:12px;color:#8b5cf6">
    INO RUN 2026 — <a href="https://inorun.com.br" style="color:#7c3aed">inorun.com.br</a>
  </div>
</div></body></html>`;
}

function emailAtleta(nome: string, bib: number | null, prova: string, categoria: string, valor: string, grupo: string): string {
  return shell(`
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:48px">🎉</div>
      <h2 style="font-size:24px;font-weight:900;font-style:italic;color:#16a34a;text-transform:uppercase;margin:8px 0">Inscrição Confirmada!</h2>
    </div>
    <p style="font-size:16px;color:#1e1b4b;margin:0 0 24px">
      Olá, <strong>${nome}</strong>! Sua inscrição pelo grupo <strong>${grupo}</strong> está <strong style="color:#16a34a">confirmada</strong>. Nos vemos em outubro! 🏃
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${row("Atleta", nome)}${row("Prova", prova)}${row("Categoria", categoria)}
      ${row("Número de peito", bib ? `#${bib}` : "—")}${row("Valor da inscrição", valor)}${row("Grupo", grupo)}
      ${row("Data", "11/10/2026 — 07h00")}${row("Local", "Paraopeba – MG")}
    </table>
    <div style="margin-top:24px;padding:14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;font-size:13px;color:#166534">
      Dúvidas: <a href="mailto:inscricoes@inorun.com.br" style="color:#16a34a">inscricoes@inorun.com.br</a>
    </div>`);
}

function emailResponsavel(
  nome: string, grupo: string, confirmados: number, total: string,
  lista: { nome: string; bib_number: number | null; prova: string }[]
): string {
  const linhas = lista.map((a) =>
    `<tr>
      <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;color:#1e1b4b">${a.nome}</td>
      <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;text-align:center">${a.prova}</td>
      <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;color:#7c3aed;font-weight:700;text-align:right">${a.bib_number ? `#${a.bib_number}` : "—"}</td>
    </tr>`).join("");
  return shell(`
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:48px">✅</div>
      <h2 style="font-size:24px;font-weight:900;font-style:italic;color:#16a34a;text-transform:uppercase;margin:8px 0">Grupo Confirmado!</h2>
    </div>
    <p style="font-size:16px;color:#1e1b4b;margin:0 0 20px">
      Olá, <strong>${nome}</strong>! A inscrição do grupo <strong>${grupo}</strong> foi confirmada:
      <strong>${confirmados} atletas</strong> · Total pago <strong>${total}</strong>.
      Cada atleta com email cadastrado recebeu a confirmação individual com o número de peito.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr>
        <td style="padding:7px 0;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase">Atleta</td>
        <td style="padding:7px 0;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;text-align:center">Prova</td>
        <td style="padding:7px 0;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;text-align:right">Peito</td>
      </tr>
      ${linhas}
    </table>
    <div style="margin-top:24px;padding:14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;font-size:13px;color:#166534">
      Dúvidas: <a href="mailto:inscricoes@inorun.com.br" style="color:#16a34a">inscricoes@inorun.com.br</a>
    </div>`);
}

function emailRejeitado(nome: string, grupo: string): string {
  return shell(`
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:48px">⚠️</div>
      <h2 style="font-size:22px;font-weight:900;color:#dc2626;text-transform:uppercase;margin:8px 0">Grupo Não Aprovado</h2>
    </div>
    <p style="font-size:15px;color:#1e1b4b;margin:0 0 16px">
      Olá, <strong>${nome}</strong>! Não foi possível confirmar a inscrição do grupo <strong>${grupo}</strong> — normalmente por problema no comprovante de pagamento.
    </p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;font-size:13px;color:#991b1b;margin-bottom:16px">
      <strong>O que fazer agora?</strong><br>
      Entre em contato conosco para reenviar o comprovante ou esclarecer o pagamento.
    </div>
    <div style="margin-top:8px;padding:14px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;font-size:13px;color:#075985">
      Contato: <a href="mailto:inscricoes@inorun.com.br" style="color:#0284c7">inscricoes@inorun.com.br</a>
    </div>`);
}
