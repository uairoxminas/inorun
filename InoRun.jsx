import { useState, useEffect, useMemo } from "react";

/* ============================================================
   INO RUN 2026 — Corrida InoLive · Paraopeba – MG · 11/10/2026
   Identidade extraída do design oficial no Canva (roxo + branco).
   3 views: 'site' · 'register' · 'admin' · mock data.
   Portável para Vite + Tailwind + Supabase.
   ============================================================ */

const T = {
  bg:       "#FBF7FD",
  white:    "#FFFFFF",
  surface:  "#FFFFFF",
  ink:      "#26122E",
  mut:      "#6E5E76",
  roxo:     "#8417AE",
  roxoDark: "#5B0E7A",
  roxoMid:  "#A93FD0",
  lilas:    "#F2E6F8",
  line:     "#ECE0F2",
  amarelo:  "#FFD200", // acento vibrante da marca
  amareloDk:"#E8B800", // amarelo para hover/realce
};

const DISPLAY = "'Saira Condensed', system-ui, sans-serif";
const BODY = "'Inter', system-ui, sans-serif";

const brl = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const TARGET = new Date("2026-10-11T07:00:00-03:00").getTime();

/* ---------------- mock data (conteúdo real do deck) ---------------- */
const PROVAS = [
  {
    id: "5k", km: "5", label: "Prova 5 km", tag: "Iniciante",
    desc: "Percurso rápido e dinâmico. Onde o iniciante começa sua jornada — ideal para buscar bem-estar, bater as primeiras metas e sentir a energia da linha de chegada.",
    price: 79, vagas: 280,
  },
  {
    id: "10k", km: "10", label: "Prova 10 km", tag: "Performance",
    desc: "Percurso desafiador para testar limites. Onde está a autoridade e a performance — feito para atletas que buscam quebrar recordes pessoais (PRs) e elevar o nível.",
    price: 99, vagas: 160,
  },
];

const LOTES = [
  { n: 1, nome: "Lote 1", status: "atual",  info: "5 km R$79 · 10 km R$99 — até 31/07" },
  { n: 2, nome: "Lote 2", status: "futuro", info: "5 km R$89 · 10 km R$109 — até 30/09" },
  { n: 3, nome: "Lote 3", status: "futuro", info: "5 km R$99 · 10 km R$119 — até 10/10" },
];

const KIT = [
  { item: "Camiseta técnica", det: "Tecido dry-fit, com a identidade Ino Run" },
  { item: "Medalha finisher", det: "Entregue na linha de chegada" },
  { item: "Número de peito", det: "Com chip de cronometragem" },
  { item: "Sacochila", det: "Para retirada do kit" },
];

const FAQ = [
  { q: "Como funciona a retirada do kit?", a: "A retirada acontece nos dias que antecedem a prova, mediante documento com foto e comprovante de inscrição." },
  { q: "Como são definidas as categorias?", a: "Individual masculino e feminino, com premiação dividida por faixa etária — o que valoriza o corredor amador em cada idade." },
  { q: "Posso transferir minha inscrição?", a: "Sim, transferências são permitidas até 15 dias antes do evento pelo painel do atleta." },
  { q: "O pagamento via Pix confirma na hora?", a: "Sim. A confirmação por Pix é automática e o número de peito é gerado em seguida." },
];

const INSCRITOS_MOCK = [
  { nome: "Mariana Alves", dist: "10 km", cat: "F 30-34", lote: 2, valor: 109, status: "Confirmado", pag: "Pix" },
  { nome: "Rafael Souza", dist: "10 km", cat: "M 35-39", lote: 2, valor: 109, status: "Confirmado", pag: "Cartão" },
  { nome: "Júlia Mendes", dist: "5 km", cat: "F 25-29", lote: 1, valor: 69, status: "Confirmado", pag: "Pix" },
  { nome: "Bruno Carvalho", dist: "5 km", cat: "M 40-44", lote: 2, valor: 89, status: "Pendente", pag: "Pix" },
  { nome: "Camila Rocha", dist: "5 km", cat: "F 20-24", lote: 2, valor: 89, status: "Confirmado", pag: "Cartão" },
  { nome: "Diego Fernandes", dist: "10 km", cat: "M 45-49", lote: 1, valor: 89, status: "Confirmado", pag: "Pix" },
];

const CAMISETAS = ["PP", "P", "M", "G", "GG", "XG"];

/* ---------------- hooks/util ---------------- */
function useCountdown(target) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const diff = Math.max(0, target - now);
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
  };
}

function categoriaPorIdade(nascimento, sexo) {
  if (!nascimento || !sexo) return "—";
  const idade = new Date(TARGET).getFullYear() - new Date(nascimento).getFullYear();
  if (idade < 20) return `${sexo} Sub-20`;
  if (idade >= 50) return `${sexo} 50+`;
  const faixas = [[20,24],[25,29],[30,34],[35,39],[40,44],[45,49]];
  const f = faixas.find(([a, b]) => idade >= a && idade <= b);
  return `${sexo} ${f ? `${f[0]}-${f[1]}` : "50+"}`;
}

/* ---------------- logo + primitivos ---------------- */
const Logo = ({ size = 28, light = false }) => (
  <span style={{
    fontFamily: DISPLAY, fontWeight: 800, fontStyle: "italic",
    fontSize: size, letterSpacing: "0.01em", lineHeight: 1,
    color: light ? T.white : T.roxo, textTransform: "uppercase",
  }}>
    INO<span style={{ color: light ? T.white : T.roxoMid }}>RUN</span>
  </span>
);

const Eyebrow = ({ children, light }) => (
  <span style={{
    fontFamily: DISPLAY, color: light ? "rgba(255,255,255,0.85)" : T.roxo,
    letterSpacing: "0.2em", fontWeight: 700, fontSize: 13, textTransform: "uppercase",
  }}>{children}</span>
);

const SectionTitle = ({ children, light }) => (
  <h2 style={{
    fontFamily: DISPLAY, fontWeight: 800, fontStyle: "italic",
    fontSize: "clamp(32px,6vw,52px)", textTransform: "uppercase",
    color: light ? T.white : T.ink, lineHeight: 0.95, marginTop: 8,
  }}>{children}</h2>
);

/* ============================================================
   SITE PÚBLICO
   ============================================================ */
function PublicSite({ onRegister, onAdmin, inscritos }) {
  const { d, h, m, s } = useCountdown(TARGET);
  const [openFaq, setOpenFaq] = useState(null);
  const pad = (n) => String(n).padStart(2, "0");

  const provaIcon = (id) =>
    id === "5k" ? (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M5 12h11M11 7l5 5-5 5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
    ) : (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2l8 3v6c0 5-3.5 8-8 11-4.5-3-8-6-8-11V5l8-3z" stroke="#fff" strokeWidth="2" strokeLinejoin="round"/></svg>
    );

  return (
    <div style={{ background: T.bg, color: T.ink, fontFamily: BODY }}>
      {/* NAV */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)",
        borderBottom: `1px solid ${T.line}`,
      }}>
        <div className="mx-auto flex items-center justify-between px-5 py-3" style={{ maxWidth: 1120 }}>
          <Logo size={26} />
          <div className="hidden items-center gap-6 md:flex" style={{ fontSize: 14, color: T.mut }}>
            <a href="#provas">Provas</a>
            <a href="#percurso">Percurso</a>
            <a href="#kit">Kit</a>
            <a href="#faq">FAQ</a>
            <button onClick={onAdmin} style={{ color: T.mut }}>Painel</button>
          </div>
          <button onClick={onRegister} style={{
            fontFamily: DISPLAY, fontWeight: 700, fontStyle: "italic", fontSize: 16, letterSpacing: "0.03em",
            background: T.roxo, color: T.white, padding: "8px 20px", borderRadius: 8, textTransform: "uppercase",
          }}>Inscreva-se</button>
        </div>
      </nav>

      {/* HERO */}
      <header style={{ position: "relative", overflow: "hidden", background: T.white }}>
        {/* formas laterais roxo + amarelo (assinatura da capa) */}
        <svg aria-hidden viewBox="0 0 400 600" preserveAspectRatio="none" style={{
          position: "absolute", left: -60, top: 0, height: "100%", width: 300, opacity: 0.2,
        }}>
          <path d="M150 0 C 70 120 230 220 150 340 C 90 440 210 520 130 600 L 0 600 L 0 0 Z" fill={T.amarelo} />
          <path d="M110 0 C 30 120 190 220 110 340 C 50 440 170 520 90 600 L 0 600 L 0 0 Z" fill={T.roxo} />
        </svg>

        <div className="mx-auto px-5 py-14 md:py-20" style={{ maxWidth: 1120, position: "relative" }}>
          <Eyebrow>Corrida InoLive · Paraopeba – MG</Eyebrow>
          <div style={{ marginTop: 14 }}>
            <span style={{
              fontFamily: DISPLAY, fontWeight: 800, fontStyle: "italic",
              fontSize: "clamp(72px,17vw,168px)", lineHeight: 0.82, color: T.roxo,
              textTransform: "uppercase", display: "block", letterSpacing: "-0.01em",
            }}>
              INO<span style={{ color: T.roxoMid }}>RUN</span>
            </span>
            <span style={{
              fontFamily: DISPLAY, fontWeight: 700, fontStyle: "italic", fontSize: "clamp(22px,5vw,40px)",
              color: T.ink, textTransform: "uppercase", letterSpacing: "0.04em",
            }}>2026 · <span style={{ background: T.amarelo, color: T.ink, padding: "0 10px", borderRadius: 6 }}>11 de outubro</span></span>
          </div>
          <p style={{ color: T.mut, maxWidth: 460, marginTop: 18, fontSize: 16 }}>
            5 km e 10 km pelas ruas de Paraopeba. Cronometragem por chip, kit completo,
            medalha finisher e premiação por faixa etária.
          </p>

          <div className="mt-10 flex flex-wrap items-end gap-2.5">
            {[["DIAS", d], ["HORAS", h], ["MIN", m], ["SEG", s]].map(([lab, val], i) => (
              <div key={lab} className="flex items-end gap-2.5">
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    fontFamily: DISPLAY, fontWeight: 800, fontSize: "clamp(38px,8vw,68px)", lineHeight: 1,
                    color: T.white, background: `linear-gradient(160deg, ${T.roxo}, ${T.roxoDark})`,
                    borderRadius: 12, padding: "10px 16px", minWidth: 84, fontVariantNumeric: "tabular-nums",
                  }}>{pad(val)}</div>
                  <div style={{ fontFamily: DISPLAY, fontSize: 12, letterSpacing: "0.18em", color: T.mut, marginTop: 8 }}>{lab}</div>
                </div>
                {i < 3 && <div style={{ color: T.roxoMid, fontSize: 38, fontWeight: 700, paddingBottom: 26 }}>:</div>}
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <button onClick={onRegister} style={{
              fontFamily: DISPLAY, fontWeight: 700, fontStyle: "italic", fontSize: 20, letterSpacing: "0.03em",
              background: T.roxo, color: T.white, padding: "14px 34px", borderRadius: 10, textTransform: "uppercase",
            }}>Garantir vaga</button>
            <div style={{ fontSize: 14, color: T.mut }}>
              <span style={{ color: T.roxo, fontFamily: DISPLAY, fontWeight: 800, fontSize: 22 }}>
                {(842 + inscritos).toLocaleString("pt-BR")}
              </span>{" "}corredores já inscritos
            </div>
          </div>
        </div>
        <div style={{ height: 8, background: `linear-gradient(90deg, ${T.roxo} 0%, ${T.roxoMid} 45%, ${T.amarelo} 100%)` }} />
      </header>

      {/* PROVAS */}
      <section id="provas" className="mx-auto px-5 py-16" style={{ maxWidth: 1120 }}>
        <Eyebrow>Provas construídas para iniciantes e avançados</Eyebrow>
        <SectionTitle>Escolha o seu desafio</SectionTitle>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {PROVAS.map((p) => (
            <div key={p.id} style={{
              background: T.white, border: `1px solid ${T.line}`, borderRadius: 18, overflow: "hidden",
              boxShadow: "0 8px 30px rgba(132,23,174,0.06)",
            }}>
              <div style={{
                background: `linear-gradient(135deg, ${T.roxo}, ${T.roxoDark})`,
                padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div className="flex items-center gap-3">
                  <div style={{
                    width: 46, height: 46, borderRadius: 99, background: "rgba(255,255,255,0.16)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{provaIcon(p.id)}</div>
                  <div>
                    <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontStyle: "italic", fontSize: 30, color: T.white, lineHeight: 1, textTransform: "uppercase" }}>{p.label}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{p.tag}</div>
                  </div>
                </div>
                <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 56, color: T.amarelo, opacity: 0.92, lineHeight: 1 }}>{p.km}K</span>
              </div>
              <div style={{ padding: 22 }}>
                <p style={{ color: T.mut, fontSize: 15, minHeight: 96 }}>{p.desc}</p>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <span style={{ fontSize: 12, color: T.mut }}>a partir de</span>
                    <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 30, color: T.roxo }}>{brl(p.price)}</div>
                  </div>
                  <button onClick={onRegister} style={{
                    fontFamily: DISPLAY, fontWeight: 700, fontStyle: "italic", fontSize: 16, letterSpacing: "0.03em",
                    background: T.roxo, color: T.white, padding: "10px 22px", borderRadius: 9, textTransform: "uppercase",
                  }}>Inscrever</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5" style={{ background: T.lilas, borderRadius: 16, padding: "20px 24px" }}>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontStyle: "italic", fontSize: 22, color: T.roxoDark, textTransform: "uppercase" }}>Categorias</div>
            <div style={{ fontSize: 15, color: T.ink }}>
              <strong>Individual</strong> — masculino e feminino, com premiação dividida por <strong>faixa etária</strong>.
            </div>
          </div>
        </div>
      </section>

      {/* LOTES */}
      <section className="mx-auto px-5 pb-16" style={{ maxWidth: 1120 }}>
        <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 16, padding: 24 }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Eyebrow>Preço sobe por lote</Eyebrow>
              <h3 style={{ fontFamily: DISPLAY, fontWeight: 800, fontStyle: "italic", fontSize: 26, marginTop: 6, textTransform: "uppercase" }}>Lotes de inscrição</h3>
            </div>
            <span style={{ background: T.amarelo, color: T.ink, fontSize: 13, fontWeight: 700, padding: "5px 12px", borderRadius: 999 }}>
              Lote 1 encerra em 31/07
            </span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {LOTES.map((l) => {
              const atual = l.status === "atual";
              return (
                <div key={l.n} style={{
                  background: atual ? T.lilas : T.bg, border: `1px solid ${atual ? T.roxoMid : T.line}`, borderRadius: 12, padding: 16,
                }}>
                  <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 18, color: T.ink }}>{l.nome}</div>
                  <div style={{ fontSize: 13, color: T.mut, marginTop: 4 }}>
                    {atual ? "Disponível agora · " : ""}{l.info}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* PERCURSO */}
      <section id="percurso" style={{ background: T.white, borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}` }}>
        <div className="mx-auto grid gap-8 px-5 py-16 md:grid-cols-2" style={{ maxWidth: 1120 }}>
          <div>
            <Eyebrow>O traçado</Eyebrow>
            <SectionTitle>Percurso</SectionTitle>
            <p style={{ color: T.mut, marginTop: 14, maxWidth: 420 }}>
              Largada e chegada no coração de Paraopeba, com pontos de hidratação ao longo do trajeto
              e apoio médico. Um circuito pensado para o seu recorde pessoal.
            </p>
            <div className="mt-6 flex gap-8">
              {[["Hidratação", "5 pts"], ["Apoio médico", "Sim"], ["Largada", "07h00"]].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 28, color: T.roxo }}>{v}</div>
                  <div style={{ fontSize: 12, color: T.mut, letterSpacing: "0.1em", textTransform: "uppercase" }}>{k}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: T.lilas, borderRadius: 16, minHeight: 240, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
            <svg viewBox="0 0 400 220" style={{ width: "100%", height: "100%" }}>
              <path d="M20 180 Q 80 60 150 120 T 280 90 T 380 40" fill="none" stroke={T.roxo} strokeWidth="3.5" strokeLinecap="round" />
              <circle cx="20" cy="180" r="7" fill={T.roxoDark} />
              <circle cx="380" cy="40" r="7" fill={T.roxoMid} />
            </svg>
            <span style={{ position: "absolute", bottom: 12, left: 16, fontSize: 12, color: T.mut }}>Mapa interativo (placeholder)</span>
          </div>
        </div>
      </section>

      {/* KIT */}
      <section id="kit" className="mx-auto px-5 py-16" style={{ maxWidth: 1120 }}>
        <Eyebrow>Incluso na inscrição</Eyebrow>
        <SectionTitle>Kit do atleta</SectionTitle>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {KIT.map((k, i) => (
            <div key={k.item} style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 14, padding: 20 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                minWidth: 38, height: 38, padding: "0 10px", background: T.amarelo, color: T.ink,
                fontFamily: DISPLAY, fontWeight: 800, fontStyle: "italic", fontSize: 20, borderRadius: 9,
              }}>{String(i + 1).padStart(2, "0")}</div>
              <div style={{ fontWeight: 600, marginTop: 12 }}>{k.item}</div>
              <div style={{ fontSize: 13, color: T.mut, marginTop: 4 }}>{k.det}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PATROCINADORES */}
      <section style={{ background: T.white, borderTop: `1px solid ${T.line}` }}>
        <div className="mx-auto flex flex-wrap items-center justify-center gap-x-12 gap-y-4 px-5 py-10" style={{ maxWidth: 1120 }}>
          <span style={{ fontSize: 12, color: T.mut, letterSpacing: "0.2em", textTransform: "uppercase", width: "100%", textAlign: "center" }}>Realização e patrocínio</span>
          {["INOLIVE", "BRAVE", "HIDRATA+", "RUNCLUB", "PARAOPEBA"].map((p) => (
            <span key={p} style={{ fontFamily: DISPLAY, fontWeight: 700, fontStyle: "italic", fontSize: 22, color: T.mut, opacity: 0.7 }}>{p}</span>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto px-5 py-16" style={{ maxWidth: 760 }}>
        <Eyebrow>Dúvidas frequentes</Eyebrow>
        <SectionTitle>FAQ</SectionTitle>
        <div className="mt-6" style={{ borderTop: `1px solid ${T.line}` }}>
          {FAQ.map((f, i) => (
            <div key={i} style={{ borderBottom: `1px solid ${T.line}` }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="flex w-full items-center justify-between text-left" style={{ padding: "18px 0", fontWeight: 600, fontSize: 16 }}>
                {f.q}
                <span style={{ color: T.roxo, fontSize: 24, lineHeight: 1 }}>{openFaq === i ? "−" : "+"}</span>
              </button>
              {openFaq === i && <p style={{ color: T.mut, paddingBottom: 18, fontSize: 15 }}>{f.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section style={{ background: `linear-gradient(135deg, ${T.roxo}, ${T.roxoDark})`, borderTop: `6px solid ${T.amarelo}` }}>
        <div className="mx-auto px-5 py-16 text-center" style={{ maxWidth: 1120 }}>
          <h2 style={{ fontFamily: DISPLAY, fontWeight: 800, fontStyle: "italic", fontSize: "clamp(34px,7vw,64px)", color: T.white, textTransform: "uppercase", lineHeight: 0.95 }}>
            Sinta a energia da chegada
          </h2>
          <button onClick={onRegister} style={{
            fontFamily: DISPLAY, fontWeight: 700, fontStyle: "italic", fontSize: 20, letterSpacing: "0.03em",
            background: T.white, color: T.roxo, padding: "14px 36px", borderRadius: 10, textTransform: "uppercase", marginTop: 22,
          }}>Quero correr</button>
        </div>
      </section>

      <footer style={{ background: T.white, borderTop: `1px solid ${T.line}` }}>
        <div className="mx-auto flex flex-wrap items-center justify-between gap-3 px-5 py-8" style={{ maxWidth: 1120, fontSize: 13, color: T.mut }}>
          <Logo size={20} />
          <span>Corrida InoLive · Paraopeba – MG · 11/10/2026 · protótipo</span>
        </div>
      </footer>
    </div>
  );
}

/* ============================================================
   FLUXO DE INSCRIÇÃO
   ============================================================ */
function RegisterFlow({ onBack, onDone }) {
  const [step, setStep] = useState(1);
  const [f, setF] = useState({
    dist: "", nome: "", cpf: "", nasc: "", sexo: "", email: "", tel: "",
    emergencia: "", camiseta: "", cupom: "", pag: "pix", termo: false,
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const prova = PROVAS.find((p) => p.id === f.dist);
  const desconto = f.cupom.trim().toUpperCase() === "INO10" ? 0.1 : 0;
  const total = prova ? prova.price * (1 - desconto) : 0;
  const cat = categoriaPorIdade(f.nasc, f.sexo);
  const bib = useMemo(() => String(1100 + Math.floor(Math.random() * 900)), []);
  const steps = ["Prova", "Seus dados", "Categoria & kit", "Pagamento", "Pronto"];

  const can = {
    1: !!f.dist,
    2: f.nome && f.cpf && f.nasc && f.sexo && f.email,
    3: !!f.camiseta,
    4: f.termo,
  };

  const field = {
    width: "100%", background: T.white, border: `1px solid ${T.line}`, borderRadius: 10,
    padding: "12px 14px", color: T.ink, fontSize: 15, fontFamily: BODY, outline: "none",
  };
  const labelS = { fontSize: 13, color: T.mut, marginBottom: 6, display: "block", fontWeight: 500 };

  return (
    <div style={{ background: T.bg, color: T.ink, fontFamily: BODY, minHeight: "100%" }}>
      <div className="mx-auto px-5 py-6" style={{ maxWidth: 560 }}>
        <div className="flex items-center justify-between">
          <button onClick={step === 1 ? onBack : () => setStep(step - 1)} style={{ color: T.mut, fontSize: 14 }}>
            ← {step === 1 ? "Voltar ao site" : "Voltar"}
          </button>
          <Logo size={22} />
        </div>

        <div className="mt-5 flex gap-1.5">
          {steps.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: i < step ? T.roxo : T.line }} />
          ))}
        </div>
        <div style={{ fontFamily: DISPLAY, fontStyle: "italic", letterSpacing: "0.1em", fontSize: 13, color: T.roxo, marginTop: 10, textTransform: "uppercase" }}>
          Passo {step} de 5 · {steps[step - 1]}
        </div>

        <div className="mt-6">
          {step === 1 && (
            <div className="grid gap-3">
              {PROVAS.map((p) => (
                <button key={p.id} onClick={() => set("dist", p.id)} className="flex items-center justify-between text-left" style={{
                  background: f.dist === p.id ? T.lilas : T.white,
                  border: `1px solid ${f.dist === p.id ? T.roxoMid : T.line}`, borderRadius: 14, padding: 18,
                }}>
                  <div>
                    <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontStyle: "italic", fontSize: 26, textTransform: "uppercase" }}>{p.label}</div>
                    <div style={{ fontSize: 13, color: T.mut }}>{p.tag}</div>
                  </div>
                  <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 24, color: T.roxo }}>{brl(p.price)}</div>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4">
              <div><label style={labelS}>Nome completo</label>
                <input style={field} value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Como no documento" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label style={labelS}>CPF</label>
                  <input style={field} value={f.cpf} onChange={(e) => set("cpf", e.target.value)} placeholder="000.000.000-00" /></div>
                <div><label style={labelS}>Nascimento</label>
                  <input type="date" style={field} value={f.nasc} onChange={(e) => set("nasc", e.target.value)} /></div>
              </div>
              <div><label style={labelS}>Sexo (para categoria)</label>
                <div className="flex gap-3">
                  {["M", "F"].map((sx) => (
                    <button key={sx} onClick={() => set("sexo", sx)} style={{
                      flex: 1, padding: 11, borderRadius: 10, fontWeight: 600,
                      background: f.sexo === sx ? T.roxo : T.white, color: f.sexo === sx ? T.white : T.ink,
                      border: `1px solid ${f.sexo === sx ? T.roxo : T.line}`,
                    }}>{sx === "M" ? "Masculino" : "Feminino"}</button>
                  ))}
                </div>
              </div>
              <div><label style={labelS}>E-mail</label>
                <input style={field} value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="voce@email.com" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label style={labelS}>Telefone</label>
                  <input style={field} value={f.tel} onChange={(e) => set("tel", e.target.value)} placeholder="(31) 90000-0000" /></div>
                <div><label style={labelS}>Contato de emergência</label>
                  <input style={field} value={f.emergencia} onChange={(e) => set("emergencia", e.target.value)} placeholder="Nome e telefone" /></div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-5">
              <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18 }}>
                <div style={{ fontSize: 13, color: T.mut }}>Sua categoria (calculada pela idade)</div>
                <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontStyle: "italic", fontSize: 30, color: T.roxo, marginTop: 4 }}>{cat}</div>
              </div>
              <div>
                <label style={labelS}>Tamanho da camiseta</label>
                <div className="flex flex-wrap gap-2">
                  {CAMISETAS.map((c) => (
                    <button key={c} onClick={() => set("camiseta", c)} style={{
                      width: 56, padding: "11px 0", borderRadius: 10, fontWeight: 700, fontFamily: DISPLAY, fontSize: 16,
                      background: f.camiseta === c ? T.roxo : T.white, color: f.camiseta === c ? T.white : T.ink,
                      border: `1px solid ${f.camiseta === c ? T.roxo : T.line}`,
                    }}>{c}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelS}>Cupom de desconto</label>
                <input style={field} value={f.cupom} onChange={(e) => set("cupom", e.target.value)} placeholder="Tente INO10" />
                {desconto > 0 && <div style={{ color: T.roxo, fontSize: 13, marginTop: 6 }}>✓ Cupom aplicado: 10% off</div>}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="grid gap-5">
              <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18 }}>
                <div style={{ fontSize: 14, color: T.mut }}>{prova?.label} · {cat} · Camiseta {f.camiseta}</div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span style={{ color: T.mut, fontSize: 14 }}>Total</span>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 34, color: T.roxo }}>{brl(total)}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[["pix", "Pix", "Confirmação na hora"], ["cartao", "Cartão", "Em até 12x"]].map(([id, t, sub]) => (
                  <button key={id} onClick={() => set("pag", id)} className="text-left" style={{
                    padding: 16, borderRadius: 12, background: f.pag === id ? T.lilas : T.white,
                    border: `1px solid ${f.pag === id ? T.roxoMid : T.line}`,
                  }}>
                    <div style={{ fontWeight: 700 }}>{t}</div>
                    <div style={{ fontSize: 12, color: T.mut, marginTop: 2 }}>{sub}</div>
                  </button>
                ))}
              </div>
              <label className="flex items-start gap-3" style={{ fontSize: 13, color: T.mut, cursor: "pointer" }}>
                <input type="checkbox" checked={f.termo} onChange={(e) => set("termo", e.target.checked)} style={{ marginTop: 3, accentColor: T.roxo, width: 18, height: 18 }} />
                <span>Li e aceito o <span style={{ color: T.roxo }}>termo de responsabilidade</span> e declaro estar apto a participar da prova.</span>
              </label>
            </div>
          )}

          {step === 5 && (
            <div className="text-center" style={{ padding: "20px 0" }}>
              <div style={{
                width: 64, height: 64, borderRadius: 99, background: T.roxo, color: T.white,
                display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", fontSize: 34, fontWeight: 800,
              }}>✓</div>
              <h2 style={{ fontFamily: DISPLAY, fontWeight: 800, fontStyle: "italic", fontSize: 36, marginTop: 16, textTransform: "uppercase" }}>Inscrição confirmada</h2>
              <p style={{ color: T.mut, marginTop: 8 }}>{f.nome || "Atleta"}, sua vaga na {prova?.label} está garantida.</p>
              <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 16, padding: 24, marginTop: 22 }}>
                <div style={{ fontSize: 12, color: T.mut, letterSpacing: "0.15em", textTransform: "uppercase" }}>Seu número de peito</div>
                <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontStyle: "italic", fontSize: 72, color: T.roxo, lineHeight: 1, margin: "6px 0" }}>{bib}</div>
                <div style={{
                  width: 88, height: 88, margin: "12px auto 0", borderRadius: 8,
                  background: `repeating-conic-gradient(${T.ink} 0% 25%, ${T.white} 0% 50%)`, backgroundSize: "16px 16px",
                  border: `4px solid ${T.ink}`,
                }} />
                <div style={{ fontSize: 12, color: T.mut, marginTop: 8 }}>QR de check-in (mock)</div>
              </div>
              <button onClick={onDone} style={{
                fontFamily: DISPLAY, fontWeight: 700, fontStyle: "italic", fontSize: 18, letterSpacing: "0.03em",
                background: T.roxo, color: T.white, padding: "13px 30px", borderRadius: 10, textTransform: "uppercase", marginTop: 22,
              }}>Voltar ao site</button>
            </div>
          )}
        </div>

        {step < 5 && (
          <button disabled={!can[step]} onClick={() => setStep(step + 1)} style={{
            width: "100%", marginTop: 26, padding: 15, borderRadius: 12,
            fontFamily: DISPLAY, fontWeight: 700, fontStyle: "italic", fontSize: 18, letterSpacing: "0.03em", textTransform: "uppercase",
            background: can[step] ? T.roxo : T.line, color: can[step] ? T.white : T.mut,
            cursor: can[step] ? "pointer" : "not-allowed",
          }}>
            {step === 4 ? `Pagar ${brl(total)}` : "Continuar"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   PAINEL DO ORGANIZADOR
   ============================================================ */
function AdminPanel({ onBack, novosInscritos }) {
  const totalInscritos = 842 + novosInscritos;
  const receita = 842 * 98 + novosInscritos * 99;
  const metrics = [
    ["Inscritos", totalInscritos.toLocaleString("pt-BR")],
    ["Receita", brl(receita)],
    ["Conversão", "5,8%"],
    ["Ticket médio", brl(98)],
  ];
  const porProva = [{ d: "5 km", v: 512 }, { d: "10 km", v: 330 + novosInscritos }];
  const max = Math.max(...porProva.map((x) => x.v));

  return (
    <div style={{ background: T.bg, color: T.ink, fontFamily: BODY, minHeight: "100%" }}>
      <div className="mx-auto px-5 py-6" style={{ maxWidth: 1000 }}>
        <div className="flex items-center justify-between">
          <button onClick={onBack} style={{ color: T.mut, fontSize: 14 }}>← Ver site público</button>
          <div className="flex items-center gap-2"><Logo size={20} /><span style={{ color: T.mut, fontSize: 14 }}>· Painel</span></div>
        </div>

        <h1 style={{ fontFamily: DISPLAY, fontWeight: 800, fontStyle: "italic", fontSize: 40, textTransform: "uppercase", marginTop: 18 }}>Visão geral</h1>

        <div className="mt-5 grid gap-3 grid-cols-2 md:grid-cols-4">
          {metrics.map(([k, v]) => (
            <div key={k} style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 12, color: T.mut, letterSpacing: "0.1em", textTransform: "uppercase" }}>{k}</div>
              <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 30, color: T.roxo, marginTop: 6 }}>{v}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 16, padding: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 16 }}>Inscritos por prova</div>
            <div className="grid gap-3">
              {porProva.map((p) => (
                <div key={p.d}>
                  <div className="flex justify-between" style={{ fontSize: 13, color: T.mut, marginBottom: 4 }}>
                    <span>{p.d}</span><span>{p.v}</span>
                  </div>
                  <div style={{ height: 10, background: T.lilas, borderRadius: 99 }}>
                    <div style={{ width: `${(p.v / max) * 100}%`, height: "100%", background: T.roxo, borderRadius: 99 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 16, padding: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 16 }}>Gestão de lotes</div>
            <div className="grid gap-2">
              {LOTES.map((l) => (
                <div key={l.n} className="flex items-center justify-between" style={{ background: T.bg, borderRadius: 10, padding: "12px 14px", fontSize: 14 }}>
                  <span>{l.nome}</span>
                  <span style={{
                    fontSize: 12, padding: "3px 10px", borderRadius: 99,
                    background: l.status === "atual" ? T.roxo : "transparent",
                    color: l.status === "atual" ? T.white : T.mut,
                    border: l.status === "atual" ? "none" : `1px solid ${T.line}`,
                  }}>{l.status === "atual" ? "Ativo" : l.status === "encerrado" ? "Encerrado" : "Agendado"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6" style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 16, padding: 20 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 600 }}>Últimos inscritos</div>
            <button style={{ fontSize: 13, color: T.white, background: T.roxo, padding: "7px 14px", borderRadius: 8, fontWeight: 600 }}>Exportar CSV</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ color: T.mut, textAlign: "left", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  <th style={{ padding: "8px 10px" }}>Atleta</th>
                  <th style={{ padding: "8px 10px" }}>Prova</th>
                  <th style={{ padding: "8px 10px" }}>Categoria</th>
                  <th style={{ padding: "8px 10px" }}>Valor</th>
                  <th style={{ padding: "8px 10px" }}>Pag.</th>
                  <th style={{ padding: "8px 10px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {INSCRITOS_MOCK.map((r, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${T.line}` }}>
                    <td style={{ padding: "11px 10px", fontWeight: 500 }}>{r.nome}</td>
                    <td style={{ padding: "11px 10px", color: T.mut }}>{r.dist}</td>
                    <td style={{ padding: "11px 10px", color: T.mut }}>{r.cat}</td>
                    <td style={{ padding: "11px 10px" }}>{brl(r.valor)}</td>
                    <td style={{ padding: "11px 10px", color: T.mut }}>{r.pag}</td>
                    <td style={{ padding: "11px 10px" }}>
                      <span style={{
                        fontSize: 12, padding: "3px 10px", borderRadius: 99,
                        background: r.status === "Confirmado" ? T.lilas : "#FDEAE4",
                        color: r.status === "Confirmado" ? T.roxoDark : "#C2410C",
                      }}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   APP
   ============================================================ */
export default function App() {
  const [view, setView] = useState("site");
  const [novos, setNovos] = useState(0);

  return (
    <div style={{ minHeight: "100vh", background: T.bg }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Saira+Condensed:ital,wght@0,600;0,700;0,800;1,600;1,700;1,800&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        button { cursor: pointer; }
        a { text-decoration: none; color: inherit; }
        ::selection { background: ${T.roxo}; color: #fff; }
        button:focus-visible, a:focus-visible, input:focus-visible { outline: 2px solid ${T.roxo}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
      `}</style>

      {view === "site" && (
        <PublicSite inscritos={novos} onRegister={() => setView("register")} onAdmin={() => setView("admin")} />
      )}
      {view === "register" && (
        <RegisterFlow onBack={() => setView("site")} onDone={() => { setNovos((n) => n + 1); setView("site"); }} />
      )}
      {view === "admin" && (
        <AdminPanel onBack={() => setView("site")} novosInscritos={novos} />
      )}
    </div>
  );
}
