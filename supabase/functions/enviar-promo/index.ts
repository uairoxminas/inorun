// supabase/functions/enviar-promo/index.ts
// Edge Function: Envia email de promoção Tamarin+Inolive para todos os atletas inscritos
// Secrets: RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Acionado via POST do painel admin (autenticado)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function sendEmail(to: string, nome: string): Promise<boolean> {
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
        subject: "🎉 Fez sua inscrição na INO RUN? Você pode ganhar um sorteio especial!",
        html: emailPromo(nome),
      }),
    });
    if (!r.ok) {
      console.error("Resend error para", to, await r.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("Email error:", e);
    return false;
  }
}

function emailPromo(nome: string): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#1a0033;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 40px rgba(132,23,174,0.35)">

  <!-- Header roxo/amarelo -->
  <div style="background:linear-gradient(135deg,#6b0fa8,#8417AE,#5B0E7A);padding:36px 32px 28px;text-align:center;position:relative">
    <div style="font-size:12px;font-weight:700;letter-spacing:3px;color:rgba(255,255,255,.65);text-transform:uppercase;margin-bottom:6px">CORRIDA INOLIVE · PARAOPEBA – MG</div>
    <div style="font-size:38px;font-weight:900;font-style:italic;color:#FFD200;text-transform:uppercase;text-shadow:0 2px 12px rgba(0,0,0,0.3)">INO RUN 2026</div>
    <div style="font-size:13px;color:rgba(255,255,255,.7);margin-top:4px">11 de outubro de 2026</div>
  </div>

  <!-- Badge destaque -->
  <div style="background:#FFD200;padding:14px 24px;text-align:center">
    <div style="font-size:18px;font-weight:900;font-style:italic;color:#1a0033;text-transform:uppercase;letter-spacing:1px">
      🎉 SORTEIO ESPECIAL PARA INSCRITOS!
    </div>
  </div>

  <!-- Corpo -->
  <div style="padding:32px">
    <p style="font-size:16px;color:#1a0033;margin:0 0 20px;line-height:1.5">
      Olá, <strong>${nome}</strong>! 👋<br><br>
      Você fez sua inscrição na <strong>INO RUN 2026</strong> e agora pode concorrer a um 
      <strong style="color:#8417AE">sorteio especial</strong> com prêmios exclusivos de 
      <strong>Tamarin</strong> e <strong>Inolive</strong>!
    </p>

    <!-- Prêmios -->
    <div style="background:linear-gradient(135deg,#fdf4ff,#ede9fe);border:2px solid #c084fc;border-radius:16px;padding:24px;margin-bottom:24px">
      <div style="font-size:15px;font-weight:800;color:#7c3aed;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px">
        🏆 Prêmios do Sorteio
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;align-items:center;gap:10px;font-size:14px;color:#1e1b4b">
          <span style="font-size:20px">🟣</span>
          <span><strong>01 Squeeze Tamarin</strong> — exclusivo da marca</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;font-size:14px;color:#1e1b4b">
          <span style="font-size:20px">🟢</span>
          <span><strong>01 Squeeze Inolive</strong> — Academia, Saúde e Lazer</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;font-size:14px;color:#1e1b4b">
          <span style="font-size:20px">🍫</span>
          <span><strong>01 Açaí Proteico Tamarin</strong></span>
        </div>
      </div>
    </div>

    <!-- Como participar -->
    <div style="background:#1a0033;border-radius:16px;padding:24px;margin-bottom:24px">
      <div style="font-size:15px;font-weight:800;color:#FFD200;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px">
        📸 Como Participar
      </div>
      <ol style="margin:0;padding:0 0 0 20px;color:rgba(255,255,255,.9);font-size:14px;line-height:2">
        <li>Poste uma foto com a <strong style="color:#FFD200">moldura oficial</strong> do INO RUN 2026</li>
        <li>Marque <strong style="color:#FFD200">@inoliveoficial</strong> e <strong style="color:#FFD200">@inoliveeventos</strong></li>
        <li>Use a hashtag <strong style="color:#FFD200">#InoRun2026</strong></li>
        <li>Pronto — você já está concorrendo!</li>
      </ol>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px">
      <a href="https://www.instagram.com/inoliveeventos" target="_blank"
        style="display:inline-block;background:linear-gradient(135deg,#8417AE,#6b0fa8);color:#FFD200;font-size:16px;font-weight:900;font-style:italic;text-transform:uppercase;text-decoration:none;padding:16px 36px;border-radius:14px;letter-spacing:1px;box-shadow:0 4px 20px rgba(132,23,174,0.4)">
        Participar do Sorteio →
      </a>
    </div>

    <p style="font-size:13px;color:#6b7280;text-align:center;margin:0">
      Dúvidas? <a href="mailto:inscricoes@inorun.com.br" style="color:#8417AE">inscricoes@inorun.com.br</a>
    </p>
  </div>

  <!-- Footer -->
  <div style="background:#fdf4ff;border-top:2px solid #ede9fe;padding:16px 32px;text-align:center;font-size:12px;color:#8b5cf6">
    INO RUN 2026 · Corrida InoLive · Paraopeba – MG ·
    <a href="https://inorun.com.br" style="color:#7c3aed">inorun.com.br</a>
  </div>

</div>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

    // Busca todos os atletas com inscrição (confirmado, pendente ou em_analise)
    // JOIN com athlete para pegar nome e email únicos
    const { data: registrations, error } = await supabase
      .from("registration")
      .select(`
        id,
        status,
        athlete ( nome, email )
      `)
      .in("status", ["confirmado", "pendente", "em_analise"]);

    if (error) return json({ error: error.message }, 500);
    if (!registrations || registrations.length === 0) {
      return json({ enviados: 0, mensagem: "Nenhum atleta encontrado." });
    }

    // Deduplicar por email (um atleta pode ter mais de uma inscrição)
    const visto = new Set<string>();
    const atletasUnicos: { nome: string; email: string }[] = [];
    for (const reg of registrations) {
      const ath = Array.isArray(reg.athlete) ? reg.athlete[0] : reg.athlete as { nome: string; email: string } | null;
      if (!ath?.email || visto.has(ath.email)) continue;
      visto.add(ath.email);
      atletasUnicos.push({ nome: ath.nome, email: ath.email });
    }

    // Enviar em lotes de 5 para não estourar o rate limit do Resend
    let enviados = 0;
    let falhas = 0;
    const LOTE = 5;
    for (let i = 0; i < atletasUnicos.length; i += LOTE) {
      const lote = atletasUnicos.slice(i, i + LOTE);
      const results = await Promise.all(lote.map(a => sendEmail(a.email, a.nome)));
      enviados += results.filter(Boolean).length;
      falhas   += results.filter(r => !r).length;
      // Pausa de 300ms entre lotes
      if (i + LOTE < atletasUnicos.length) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    return json({
      ok: true,
      total_atletas: atletasUnicos.length,
      enviados,
      falhas,
    });

  } catch (e) {
    console.error("Unhandled error:", e);
    return json({ error: String(e) }, 500);
  }
});
