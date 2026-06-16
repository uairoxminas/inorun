// src/pages/PublicSite.tsx — INO RUN 2026 · Site público com dados reais do Supabase

import { useState, useEffect } from 'react';
import Logo from '../components/Logo';
import Eyebrow from '../components/ui/Eyebrow';
import SectionTitle from '../components/ui/SectionTitle';
import CountdownBox from '../components/ui/CountdownBox';
import ProvaCard from '../components/ui/ProvaCard';
import LoteCard from '../components/ui/LoteCard';
import KitItem from '../components/ui/KitItem';
import { useCountdown } from '../hooks/useCountdown';
import { getEventoPublico, getLoteAtivo, getLotesDaProva } from '../services/eventoService';
import type { EventoData } from '../services/eventoService';
import { formataBRL } from '../lib/precoLoteAtual';

interface Props {
  onRegister: () => void;
  onAdmin: () => void;
  totalInscritos: number;
  onEventoCarregado?: (e: EventoData) => void;
}

const FAQ_ITEMS = [
  { q: 'Como funciona a retirada do kit?',    a: 'A retirada acontece nos dias que antecedem a prova, mediante documento com foto e comprovante de inscrição.' },
  { q: 'Como são definidas as categorias?',   a: 'Individual masculino e feminino, com premiação por faixa etária — Sub-20, 20-24, 25-29, 30-34, 35-39, 40-44, 45-49 e 50+. A categoria é calculada pela idade na data da prova (11/10/2026).' },
  { q: 'Posso me inscrever em grupo?',         a: 'Sim! O sistema permite inscrição de múltiplos atletas em uma única sessão.' },
  { q: 'O pagamento via Pix confirma na hora?', a: 'Sim. A confirmação por Pix é automática e o número de peito é gerado em seguida.' },
  { q: 'Posso transferir minha inscrição?',   a: 'Sim, transferências são permitidas até 15 dias antes do evento pelo painel do atleta.' },
];

const KIT_ITEMS = [
  { item: 'Camiseta técnica',  det: 'Tecido dry-fit com identidade Ino Run' },
  { item: 'Medalha finisher',  det: 'Entregue na linha de chegada' },
  { item: 'Número de peito',   det: 'Com chip de cronometragem' },
  { item: 'Sacochila',         det: 'Para retirada do kit' },
];

export default function PublicSite({ onRegister, onAdmin, totalInscritos, onEventoCarregado }: Props) {
  const { d, h, m, s } = useCountdown();
  const [openFaq, setOpenFaq]   = useState<number | null>(null);
  const [evento, setEvento]     = useState<EventoData | null>(null);
  const [loadingEvento, setLoadingEvento] = useState(true);

  useEffect(() => {
    getEventoPublico()
      .then(e => { setEvento(e); onEventoCarregado?.(e); })
      .catch(console.error)
      .finally(() => setLoadingEvento(false));
  }, []);

  const inscritos = evento?.totalInscritos ?? totalInscritos;

  const race5k  = evento?.races.find(r => r.distancia_km === 5);
  const race10k = evento?.races.find(r => r.distancia_km === 10);
  const lote5k  = race5k  ? getLoteAtivo(evento!.lots, race5k.id)  : null;
  const lote10k = race10k ? getLoteAtivo(evento!.lots, race10k.id) : null;

  return (
    <div className="bg-brand-bg text-brand-ink font-sans">

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-brand-lilac-mid">
        <div className="section-wrap flex items-center justify-between py-3">
          <Logo height={32} />
          <div className="hidden md:flex items-center gap-6 text-sm text-brand-muted">
            <a href="#provas"   className="hover:text-brand-purple transition-colors">Provas</a>
            <a href="#percurso" className="hover:text-brand-purple transition-colors">Percurso</a>
            <a href="#kit"      className="hover:text-brand-purple transition-colors">Kit</a>
            <a href="#faq"      className="hover:text-brand-purple transition-colors">FAQ</a>
            <button onClick={onAdmin} className="btn-ghost">Painel</button>
          </div>
          <button id="nav-inscreva-se" onClick={onRegister} className="btn-primary text-sm py-2.5 px-5">
            Inscreva-se
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <header className="relative overflow-hidden bg-white">
        <svg aria-hidden viewBox="0 0 400 600" preserveAspectRatio="none"
          className="absolute left-[-60px] top-0 h-full w-[300px] opacity-20 pointer-events-none">
          <path d="M150 0 C 70 120 230 220 150 340 C 90 440 210 520 130 600 L 0 600 L 0 0 Z" fill="#FFD200" />
          <path d="M110 0 C 30 120 190 220 110 340 C 50 440 170 520 90 600 L 0 600 L 0 0 Z" fill="#8417AE" />
        </svg>

        <div className="section-wrap relative py-14 md:py-20">
          <Eyebrow>Corrida InoLive · Paraopeba – MG</Eyebrow>
          <div className="mt-4">
            <span className="font-display font-extrabold italic uppercase block leading-[0.82] tracking-[-0.01em] text-brand-purple"
              style={{ fontSize: 'clamp(72px,17vw,160px)' }}>
              INO<span className="text-brand-purple-mid">RUN</span>
            </span>
            <span className="font-display font-bold italic uppercase tracking-[0.04em] text-brand-ink"
              style={{ fontSize: 'clamp(22px,5vw,40px)' }}>
              2026 ·{' '}
              <span className="bg-brand-yellow text-brand-ink px-2.5 py-0.5 rounded-md">11 de outubro</span>
            </span>
          </div>
          <p className="text-brand-muted max-w-[460px] mt-4 text-base leading-relaxed">
            5 km e 10 km pelas ruas de Paraopeba. Cronometragem por chip, kit completo,
            medalha finisher e premiação por faixa etária.
          </p>

          {/* Countdown */}
          <div className="mt-10 flex flex-wrap items-end gap-2.5">
            {([['DIAS', d], ['HORAS', h], ['MIN', m], ['SEG', s]] as [string, number][]).map(([lab, val], i) => (
              <div key={lab} className="flex items-end gap-2.5">
                <CountdownBox value={val} label={lab} />
                {i < 3 && <span className="text-brand-purple-mid font-bold pb-7" style={{ fontSize: 38 }}>:</span>}
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-5">
            <button id="hero-garantir-vaga" onClick={onRegister} className="btn-primary text-xl px-9 py-4">
              Garantir vaga
            </button>
            <div className="text-sm text-brand-muted">
              <span className="font-display font-extrabold text-brand-purple" style={{ fontSize: 22 }}>
                {inscritos.toLocaleString('pt-BR')}
              </span>{' '}corredores já inscritos
            </div>
          </div>
        </div>
        <div className="h-2 bg-gradient-brand-h" />
      </header>

      {/* ── PROVAS ── */}
      <section id="provas" className="section-wrap section-pad">
        <Eyebrow>Provas construídas para iniciantes e avançados</Eyebrow>
        <SectionTitle>Escolha o seu desafio</SectionTitle>

        {loadingEvento ? (
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {[0,1].map(i => (
              <div key={i} className="card overflow-hidden animate-pulse">
                <div className="bg-brand-lilac h-[100px]" />
                <div className="p-6 space-y-3">
                  <div className="h-4 bg-brand-lilac-mid rounded w-3/4" />
                  <div className="h-4 bg-brand-lilac-mid rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {race5k && (
              <ProvaCard id="5km" km="5" label={race5k.label} tag="Iniciante"
                desc={race5k.descricao}
                preco={lote5k?.preco_centavos ?? 7900}
                onInscrever={onRegister} />
            )}
            {race10k && (
              <ProvaCard id="10km" km="10" label={race10k.label} tag="Performance"
                desc={race10k.descricao}
                preco={lote10k?.preco_centavos ?? 9900}
                onInscrever={onRegister} />
            )}
          </div>
        )}

        <div className="mt-5 bg-brand-lilac rounded-2xl px-6 py-5">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <span className="font-display font-extrabold italic uppercase text-[22px] text-brand-purple-dark">Categorias</span>
            <span className="text-[15px] text-brand-ink">
              <strong>Individual</strong> M/F · Sub-20 · 20-24 · 25-29 · 30-34 · 35-39 · 40-44 · 45-49 · 50+
            </span>
          </div>
        </div>
      </section>

      {/* ── LOTES ── */}
      <section className="section-wrap pb-16">
        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Eyebrow>Preço sobe por lote</Eyebrow>
              <h3 className="font-display font-extrabold italic uppercase text-[26px] mt-1.5 text-brand-ink">Lotes de inscrição</h3>
            </div>
            <span className="badge-lot-active">⏰ Lote 1 encerra em 31/07</span>
          </div>

          {!loadingEvento && race5k && (
            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-widest text-brand-muted mb-3">5 km</p>
              <div className="grid gap-3 md:grid-cols-3">
                {getLotesDaProva(evento!.lots, race5k.id).map(l => (
                  <LoteCard key={l.id} nome={l.nome}
                    info={`${formataBRL(l.preco_centavos)} · até ${new Date(l.fecha_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`}
                    ativo={lote5k?.id === l.id} />
                ))}
              </div>
            </div>
          )}

          {!loadingEvento && race10k && (
            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-widest text-brand-muted mb-3">10 km</p>
              <div className="grid gap-3 md:grid-cols-3">
                {getLotesDaProva(evento!.lots, race10k.id).map(l => (
                  <LoteCard key={l.id} nome={l.nome}
                    info={`${formataBRL(l.preco_centavos)} · até ${new Date(l.fecha_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`}
                    ativo={lote10k?.id === l.id} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── PERCURSO ── */}
      <section id="percurso" className="bg-white border-y border-brand-lilac-mid">
        <div className="section-wrap section-pad grid gap-8 md:grid-cols-2">
          <div>
            <Eyebrow>O traçado</Eyebrow>
            <SectionTitle>Percurso</SectionTitle>
            <p className="text-brand-muted mt-4 max-w-[420px] leading-relaxed">
              Largada e chegada no coração de Paraopeba, com pontos de hidratação ao longo do trajeto e apoio médico.
            </p>
            <div className="mt-6 flex gap-8">
              {[['5 pts', 'Hidratação'], ['Sim', 'Apoio médico'], ['07h00', 'Largada']].map(([v, k]) => (
                <div key={k}>
                  <div className="font-display font-extrabold text-[28px] text-brand-purple">{v}</div>
                  <div className="text-[12px] text-brand-muted tracking-[0.1em] uppercase">{k}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-brand-lilac rounded-2xl min-h-[240px] relative overflow-hidden flex items-center justify-center">
            <svg viewBox="0 0 400 220" className="w-full h-full">
              <path d="M20 180 Q 80 60 150 120 T 280 90 T 380 40" fill="none" stroke="#8417AE" strokeWidth="3.5" strokeLinecap="round" />
              <circle cx="20" cy="180" r="7" fill="#5B0E7A" />
              <circle cx="380" cy="40" r="7" fill="#A93FD0" />
              <text x="20" y="200" fontSize="11" fill="#6E5E76" fontFamily="Inter">Largada</text>
              <text x="345" y="35" fontSize="11" fill="#6E5E76" fontFamily="Inter">Chegada</text>
            </svg>
            <span className="absolute bottom-3 left-4 text-[12px] text-brand-muted">Mapa ilustrativo</span>
          </div>
        </div>
      </section>

      {/* ── KIT ── */}
      <section id="kit" className="section-wrap section-pad">
        <Eyebrow>Incluso na inscrição</Eyebrow>
        <SectionTitle>Kit do atleta</SectionTitle>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {KIT_ITEMS.map((k, i) => <KitItem key={k.item} numero={i + 1} item={k.item} det={k.det} />)}
        </div>
      </section>

      {/* ── PATROCINADORES ── */}
      <section className="bg-white border-t border-brand-lilac-mid">
        <div className="section-wrap py-10 flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
          <span className="text-[12px] text-brand-muted tracking-[0.2em] uppercase w-full text-center">Realização e patrocínio</span>
          {['INOLIVE', 'BRAVE', 'HIDRATA+', 'RUNCLUB', 'PARAOPEBA'].map(p => (
            <span key={p} className="font-display font-bold italic text-[22px] text-brand-muted opacity-60">{p}</span>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="mx-auto px-5 section-pad" style={{ maxWidth: 760 }}>
        <Eyebrow>Dúvidas frequentes</Eyebrow>
        <SectionTitle>FAQ</SectionTitle>
        <div className="mt-6 border-t border-brand-lilac-mid">
          {FAQ_ITEMS.map((f, i) => (
            <div key={i} className="border-b border-brand-lilac-mid">
              <button id={`faq-${i}`}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full items-center justify-between text-left py-5 font-semibold text-[16px] text-brand-ink">
                {f.q}
                <span className="text-brand-purple text-2xl leading-none ml-4 flex-shrink-0">{openFaq === i ? '−' : '+'}</span>
              </button>
              {openFaq === i && <p className="text-brand-muted pb-5 text-[15px] leading-relaxed">{f.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="bg-gradient-brand border-t-[6px] border-brand-yellow">
        <div className="section-wrap py-16 text-center">
          <h2 className="font-display font-extrabold italic uppercase text-white leading-none"
            style={{ fontSize: 'clamp(34px,7vw,64px)' }}>
            Sinta a energia da chegada
          </h2>
          <p className="text-white/70 mt-4 text-base max-w-md mx-auto">
            Vagas limitadas. Garanta a sua agora com o menor preço do Lote 1.
          </p>
          <button id="cta-quero-correr" onClick={onRegister} className="mt-8 btn-accent text-xl px-10 py-4">
            Quero correr
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-white border-t border-brand-lilac-mid">
        <div className="section-wrap flex flex-wrap items-center justify-between gap-3 py-8 text-[13px] text-brand-muted">
          <Logo height={24} />
          <span>Corrida InoLive · Paraopeba – MG · 11/10/2026</span>
          <span>© 2026 INO RUN · Todos os direitos reservados</span>
        </div>
      </footer>
    </div>
  );
}
