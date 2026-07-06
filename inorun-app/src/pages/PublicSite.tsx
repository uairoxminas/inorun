// src/pages/PublicSite.tsx — INO RUN 2026 · Site público com dados reais do Supabase

import { useState, useEffect } from 'react';
import Logo from '../components/Logo';
import StravaRoute from '../components/StravaRoute';
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
import { buscarResultadosAtleta, getResultadosLeaderboard } from '../services/resultadosService';
import type { ResultadoRow } from '../services/resultadosService';

interface Props {
  onRegister: () => void;
  onRegisterGrupo?: () => void;
  onAdmin: () => void;
  totalInscritos: number;
  onEventoCarregado?: (e: EventoData) => void;
}

const FAQ_ITEMS = [
  { q: 'Como funciona a retirada do kit?',    a: 'A retirada será na INOLIVE, na semana da prova, mediante documento com foto e comprovante de inscrição.' },
  { q: 'Como são definidas as categorias?',   a: 'Corrida 5 km e 10 km: masculino e feminino com premiação por faixa etária — Sub-20 (13-19), 20-29, 30-39, 40-49 e 50+. Kids Geral (até 12 anos · 300 metros): todos ganham medalha. Caminhada 5 km: todos ganham medalha. A categoria é calculada pela idade na data da prova (11/10/2026).' },
  { q: 'Posso me inscrever em grupo?',         a: 'Sim! Grupos, assessorias e equipes com 10 atletas ou mais têm valor especial de R$89 por inscrição. O responsável cadastra todos de uma vez e paga em um único Pix. Use o botão "Inscrição em grupo".' },
  { q: 'O pagamento via Pix confirma na hora?', a: 'Sim. A confirmação por Pix é automática e o número de peito é gerado em seguida.' },
  { q: 'Posso transferir minha inscrição?',   a: 'Sim, transferências são permitidas até 15 dias antes do evento pelo painel do atleta.' },
  { q: 'Como funciona a prova Kids?',          a: 'A prova Kids é uma corrida de 300 metros para crianças de até 12 anos. Todos os participantes ganham medalha e sobem ao pódio — não há classificação competitiva, só celebração!' },
  { q: 'A caminhada tem cronometragem?',       a: 'Não. A Caminhada é de 5 km, inclusiva e sem cronometragem competitiva. Todos os participantes ganham medalha e sobem ao pódio!' },
];

const KIT_ITEMS = [
  { item: 'Camiseta técnica',  det: 'Tecido dry-fit com identidade Ino Run' },
  { item: 'Medalha finisher',  det: 'Entregue na linha de chegada' },
  { item: 'Número de peito',   det: 'Com chip de cronometragem' },
];

export default function PublicSite({ onRegister, onRegisterGrupo, onAdmin, onEventoCarregado }: Props) {
  const { d, h, m, s } = useCountdown();
  const [openFaq, setOpenFaq]   = useState<number | null>(null);
  const [evento, setEvento]     = useState<EventoData | null>(null);
  const [loadingEvento, setLoadingEvento] = useState(true);
  const [menuAberto, setMenuAberto]       = useState(false);

  // Estados para Regulamento e Resultados
  const [modalRegulamentoAberto, setModalRegulamentoAberto] = useState(false);
  const [modalResultadosAberto, setModalResultadosAberto] = useState(false);

  // Estados para Busca de Resultados
  const [termoBusca, setTermoBusca] = useState('');
  const [resultadosBusca, setResultadosBusca] = useState<ResultadoRow[]>([]);
  const [loadingBusca, setLoadingBusca] = useState(false);
  const [realizouBusca, setRealizouBusca] = useState(false);

  // Estados para Leaderboard de Resultados
  const [distanciaLeaderboard, setDistanciaLeaderboard] = useState<number>(5);
  const [resultadosLeaderboard, setResultadosLeaderboard] = useState<ResultadoRow[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todos');
  const [filtroNomeLeaderboard, setFiltroNomeLeaderboard] = useState('');

  // Busca atleta individual
  const handleBuscaAtleta = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = termoBusca.trim();
    if (!query) return;

    setLoadingBusca(true);
    setRealizouBusca(true);
    const res = await buscarResultadosAtleta(query);
    setResultadosBusca(res);
    setLoadingBusca(false);
  };

  // Carrega leaderboard quando abre o modal ou muda a distância
  useEffect(() => {
    if (!modalResultadosAberto) return;
    
    const carregarLeaderboard = async () => {
      setLoadingLeaderboard(true);
      const res = await getResultadosLeaderboard(distanciaLeaderboard);
      setResultadosLeaderboard(res);
      setLoadingLeaderboard(false);
    };
    
    carregarLeaderboard();
  }, [modalResultadosAberto, distanciaLeaderboard]);

  // Filtra o leaderboard no front-end
  const leaderboardFiltrado = resultadosLeaderboard.filter(row => {
    const atendeCategoria = categoriaFiltro === 'Todos' || row.categoria.toLowerCase() === categoriaFiltro.toLowerCase();
    const atendeNome = !filtroNomeLeaderboard || row.nome.toLowerCase().includes(filtroNomeLeaderboard.toLowerCase()) || String(row.bib_number).includes(filtroNomeLeaderboard);
    return atendeCategoria && atendeNome;
  });

  useEffect(() => {
    getEventoPublico()
      .then(e => { setEvento(e); onEventoCarregado?.(e); })
      .catch(console.error)
      .finally(() => setLoadingEvento(false));
  }, []);

  // Provas por tipo (v2: corrida 5k, corrida 10k, kids, caminhada)
  // Resiliência: se tipo = null (migration 013 ainda não rodada no banco),
  // provas com distancia_km definida são tratadas como corrida
  const race5k      = evento?.races.find(r =>
    (r.tipo === 'corrida' || !r.tipo) && r.distancia_km === 5
  );
  const race10k     = evento?.races.find(r =>
    (r.tipo === 'corrida' || !r.tipo) && r.distancia_km === 10
  );
  const raceKids    = evento?.races.find(r => r.tipo === 'kids');
  const raceCaminhada = evento?.races.find(r => r.tipo === 'caminhada');
  const lote5k      = race5k      ? getLoteAtivo(evento!.lots, race5k.id)      : null;
  const lote10k     = race10k     ? getLoteAtivo(evento!.lots, race10k.id)     : null;
  const loteKids    = raceKids    ? getLoteAtivo(evento!.lots, raceKids.id)    : null;
  const loteCaminhada = raceCaminhada ? getLoteAtivo(evento!.lots, raceCaminhada.id) : null;

  // Filtro de categorias dinâmico — derivado dos resultados carregados do banco
  const categoriasDisponiveis = [
    'Todos',
    ...Array.from(new Set(resultadosLeaderboard.map(r => r.categoria))).sort(),
  ];

  return (
    <div className="bg-brand-bg text-brand-ink font-sans">

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-brand-lilac-mid">
        <div className="section-wrap flex items-center justify-between py-3">
          <Logo height={32} />

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6 text-sm text-brand-muted">
            <a href="#provas"   className="hover:text-brand-purple transition-colors">Provas</a>
            <a href="#percurso" className="hover:text-brand-purple transition-colors">Percurso</a>
            <a href="#kit"      className="hover:text-brand-purple transition-colors">Kit</a>
            <a href="#faq"      className="hover:text-brand-purple transition-colors">FAQ</a>
            <button onClick={() => setModalRegulamentoAberto(true)} className="hover:text-brand-purple transition-colors font-medium">Regulamento</button>
            <button onClick={() => setModalResultadosAberto(true)}  className="hover:text-brand-purple transition-colors font-medium">Resultados</button>
            <button onClick={onAdmin} className="btn-ghost">Painel</button>
          </div>

          {/* Mobile direita: hambúrguer + inscreva-se */}
          <div className="flex items-center gap-2 md:hidden">
            <button id="nav-inscreva-se-mobile" onClick={onRegister}
              className="btn-primary text-xs py-2 px-3">
              Inscreva-se
            </button>
            <button id="btn-menu-mobile" onClick={() => setMenuAberto(v => !v)}
              aria-label="Menu"
              className="p-2 rounded-xl text-brand-ink hover:bg-brand-lilac transition-colors">
              {menuAberto ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-6 h-6">
                  <path d="M6 18L18 6M6 6l12 12"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-6 h-6">
                  <path d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
              )}
            </button>
          </div>

          {/* Desktop inscreva-se */}
          <button id="nav-inscreva-se" onClick={onRegister} className="btn-primary text-sm py-2.5 px-5 hidden md:block">
            Inscreva-se
          </button>
        </div>

        {/* Mobile dropdown menu */}
        {menuAberto && (
          <div className="md:hidden border-t border-brand-lilac-mid bg-white shadow-lg animate-fade-up">
            <div className="section-wrap py-4 flex flex-col gap-1">
              {[
                { label: 'Provas',    href: '#provas' },
                { label: 'Percurso', href: '#percurso' },
                { label: 'Kit',      href: '#kit' },
                { label: 'FAQ',      href: '#faq' },
              ].map(item => (
                <a key={item.label} href={item.href}
                  onClick={() => setMenuAberto(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-brand-ink font-medium text-[15px] hover:bg-brand-lilac hover:text-brand-purple transition-colors">
                  {item.label}
                </a>
              ))}
              <button onClick={() => { setMenuAberto(false); setModalRegulamentoAberto(true); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-brand-ink font-medium text-[15px] hover:bg-brand-lilac hover:text-brand-purple transition-colors text-left w-full">
                Regulamento
              </button>
              <button onClick={() => { setMenuAberto(false); setModalResultadosAberto(true); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-brand-ink font-medium text-[15px] hover:bg-brand-lilac hover:text-brand-purple transition-colors text-left w-full">
                Resultados
              </button>
              <div className="border-t border-brand-lilac-mid mt-2 pt-3">
                <button id="btn-menu-mobile-inscrever" onClick={() => { setMenuAberto(false); onRegister(); }}
                  className="btn-primary w-full py-3 text-[16px]">
                  🏃 Inscreva-se agora
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <header className="relative overflow-hidden bg-white">
        {/* Arte decorativa lateral — sem z-index para não isolar contexto */}
        <svg aria-hidden viewBox="0 0 400 600" preserveAspectRatio="none"
          className="absolute left-[-60px] top-0 h-full w-[300px] opacity-30 pointer-events-none">
          <path d="M150 0 C 70 120 230 220 150 340 C 90 440 210 520 130 600 L 0 600 L 0 0 Z" fill="#FFD200" />
          <path d="M110 0 C 30 120 190 220 110 340 C 50 440 170 520 90 600 L 0 600 L 0 0 Z" fill="#8417AE" />
        </svg>

        {/* Conteúdo */}
        <div className="section-wrap relative py-10 md:py-20">
          <Eyebrow>Corrida InoLive · Paraopeba – MG</Eyebrow>
          <div className="mt-4">
            <img
              src="/logo.png"
              alt="INO RUN 2026"
              style={{
                width: 'clamp(180px,50vw,540px)',
                height: 'auto',
                display: 'block',
              }}
              className="mb-3"
            />
            <span className="font-display font-bold italic uppercase tracking-[0.04em] text-brand-ink"
              style={{ fontSize: 'clamp(18px,5vw,40px)' }}>
              2026 ·{' '}
              <span className="bg-brand-yellow text-brand-ink px-2.5 py-0.5 rounded-md">11 de outubro</span>
            </span>
          </div>
          <p className="text-brand-muted max-w-[460px] mt-3 text-[14px] md:text-base leading-relaxed">
            5 km e 10 km pelas ruas de Paraopeba. Cronometragem por chip, kit completo,
            medalha finisher e premiação por faixa etária.
          </p>

          {/* Countdown */}
          <div className="mt-6 flex items-end gap-1 sm:gap-2.5 flex-nowrap">
            {([['DIAS', d], ['HORAS', h], ['MIN', m], ['SEG', s]] as [string, number][]).map(([lab, val], i) => (
              <div key={lab} className="flex items-end gap-1 sm:gap-2.5">
                <CountdownBox value={val} label={lab} />
                {i < 3 && (
                  <span
                    className="text-brand-purple-mid font-bold shrink-0"
                    style={{ fontSize: 'clamp(20px,5vw,38px)', paddingBottom: 'clamp(14px,4vw,30px)' }}
                  >:</span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-4">
            <button id="hero-garantir-vaga" onClick={onRegister} className="btn-primary text-[18px] md:text-xl px-9 py-4 w-full sm:w-auto">
              Garantir vaga
            </button>
            {onRegisterGrupo && (
              <button id="hero-inscricao-grupo" onClick={onRegisterGrupo}
                className="btn-outline text-[16px] md:text-lg px-7 py-4 w-full sm:w-auto">
                👥 Inscrição em grupo
              </button>
            )}
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
            {[0,1,2,3].map(i => (
              <div key={i} className="card overflow-hidden animate-pulse">
                <div className="bg-brand-lilac h-[80px]" />
                <div className="p-5 space-y-2">
                  <div className="h-4 bg-brand-lilac-mid rounded w-3/4" />
                  <div className="h-3 bg-brand-lilac-mid rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {/* Corridas — grid 2 colunas */}
            <div className="grid gap-5 md:grid-cols-2">
              {race5k && (
                <ProvaCard id="5km" km="5" label={race5k.label} tag="Iniciante"
                  desc={race5k.descricao}
                  preco={lote5k?.preco_centavos ?? 9900}
                  onInscrever={onRegister} />
              )}
              {race10k && (
                <ProvaCard id="10km" km="10" label={race10k.label} tag="Performance"
                  desc={race10k.descricao}
                  preco={lote10k?.preco_centavos ?? 9900}
                  onInscrever={onRegister} />
              )}
            </div>

            {/* Kids e Caminhada — sempre visíveis (fallback estático se não estiver no banco ainda) */}
            <div className="grid gap-5 md:grid-cols-2">
              {/* Card Kids */}
              <button id="card-prova-kids" onClick={onRegister}
                className="text-left p-5 rounded-2xl border-2 border-yellow-400 bg-yellow-50 hover:shadow-md transition-all duration-150 group">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-[11px] font-bold tracking-widest uppercase text-yellow-700">🎖️ Kids · até 12 anos · 300m</span>
                    <div className="font-display font-extrabold italic text-[26px] uppercase text-yellow-800 leading-none mt-0.5">
                      {raceKids?.label ?? 'Kids - 300 metros'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-yellow-700">a partir de</div>
                    <div className="font-display font-extrabold text-[22px] text-yellow-700">
                      {formataBRL(loteKids?.preco_centavos ?? 5000)}
                    </div>
                  </div>
                </div>
                <p className="text-[13px] text-yellow-800 leading-relaxed">
                  {raceKids?.descricao || 'Corrida de 300 metros para crianças de até 12 anos. Todos sobem ao pódio — não há classificação, só celebração!'}
                </p>
                <div className="mt-3 inline-block bg-yellow-400 text-yellow-900 text-[11px] font-bold px-3 py-1 rounded-full">
                  🏅 Todos ganham medalha!
                </div>
              </button>

              {/* Card Caminhada */}
              <button id="card-prova-caminhada" onClick={onRegister}
                className="text-left p-5 rounded-2xl border-2 border-green-400 bg-green-50 hover:shadow-md transition-all duration-150 group">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-[11px] font-bold tracking-widest uppercase text-green-700">🚶 Caminhada · Idade livre</span>
                    <div className="font-display font-extrabold italic text-[26px] uppercase text-green-800 leading-none mt-0.5">
                      {raceCaminhada?.label ?? 'Caminhada - 5 KM'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-green-700">a partir de</div>
                    <div className="font-display font-extrabold text-[22px] text-green-700">
                      {formataBRL(loteCaminhada?.preco_centavos ?? 9900)}
                    </div>
                  </div>
                </div>
                <p className="text-[13px] text-green-800 leading-relaxed">
                  {raceCaminhada?.descricao || 'Caminhada de 5 km, inclusiva e sem cronometragem competitiva. Aberta para qualquer idade. Todos ganham medalha e sobem ao pódio!'}
                </p>
                <div className="mt-3 inline-block bg-green-500 text-white text-[11px] font-bold px-3 py-1 rounded-full">
                  🏅 Todos ganham medalha!
                </div>
              </button>
            </div>
          </div>
        )}


        {/* Badge de categorias — v2 com Kids e Caminhada */}
        <div className="mt-5 bg-brand-lilac rounded-2xl px-6 py-5">
          <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
            <span className="font-display font-extrabold italic uppercase text-[22px] text-brand-purple-dark shrink-0">Categorias</span>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-brand-ink">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-muted block mb-1">🏃 Corrida 5 km e 10 km</span>
                <strong>Masc. e Fem.</strong> · Sub-20 · 20-29 · 30-39 · 40-49 · 50+
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-muted block mb-1">🎖️ Kids (até 12 anos · 300m)</span>
                <strong className="text-yellow-700">Kids Geral</strong> · Todos ganham medalha!
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-muted block mb-1">🚶 Caminhada</span>
                <strong className="text-green-700">Todos ganham medalha</strong> · 5 km sem cronometragem
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BANNER FOTO CORREDORES ── */}
      <section className="relative overflow-hidden" style={{ minHeight: 280 }}>
        <img
          src="/foto-corredores.jpg"
          alt="Corredores INO RUN com a camiseta oficial"
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-purple/90 via-brand-purple/70 to-transparent" />
        <div className="relative section-wrap py-12 md:py-24 flex flex-col justify-center" style={{ minHeight: 280 }}>
          <span className="font-display font-bold tracking-[0.2em] uppercase text-[12px] text-white/70 mb-2">
            Corrida InoLive · Paraopeba – MG
          </span>
          <h2
            className="font-display font-extrabold italic uppercase text-white leading-none"
            style={{ fontSize: 'clamp(26px,7vw,72px)', maxWidth: 600 }}
          >
            Uma nova era das corridas na região
          </h2>
          <p className="text-white/80 mt-3 text-[14px] leading-relaxed max-w-[480px]">
            Venha fazer parte dessa história e cruzar a linha de chegada com a camiseta que vai marcar sua memória.
          </p>
          <button
            onClick={onRegister}
            className="mt-6 bg-brand-yellow text-brand-ink font-display font-extrabold italic uppercase px-8 py-3.5 rounded-2xl text-[16px] md:text-[18px] hover:scale-105 transition-transform duration-200 shadow-lg w-full sm:w-auto self-start"
          >
            Garantir minha vaga →
          </button>
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
            {lote5k && (
              <span className="badge-lot-active">
                ⏰ {lote5k.nome} encerra em {new Date(lote5k.fecha_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </span>
            )}
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
              Largada e chegada na porta da academia Inolive, com pontos de hidratação ao longo do trajeto e apoio médico.
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
          <StravaRoute
            routeId="3508835983352422502"
            routeUrl="https://www.strava.com/routes/3508835983352422502" />
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
          <img src="/inolive.jpg" alt="INOLIVE"
            className="h-16 md:h-20 w-auto rounded-lg object-contain" />
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
        <div className="section-wrap py-8 text-[13px] text-brand-muted">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-4">
            <Logo height={24} />
            <div className="flex items-center gap-4 flex-wrap">
              <button onClick={() => setModalRegulamentoAberto(true)} className="hover:text-brand-purple transition-colors font-medium">Regulamento</button>
              <button onClick={() => setModalResultadosAberto(true)} className="hover:text-brand-purple transition-colors font-medium">Resultados</button>
              <button onClick={onAdmin} className="hover:text-brand-purple transition-colors font-medium">Painel</button>
            </div>
            <span className="text-[12px]">Corrida InoLive · Paraopeba – MG · 11/10/2026</span>
            <span className="text-[12px]">© 2026 INO RUN · Todos os direitos reservados</span>
          </div>
        </div>
      </footer>

      {/* ── MODAL 1: REGULAMENTO (A3 - Texto Corrido) ── */}
      {modalRegulamentoAberto && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto flex flex-col">
          {/* Header Fixo do Modal */}
          <header className="sticky top-0 bg-white border-b border-brand-lilac-mid px-6 py-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <Logo height={26} />
              <span className="font-display font-extrabold italic uppercase text-brand-purple text-lg border-l border-brand-lilac-mid pl-3">Regulamento Oficial</span>
            </div>
            <button 
              onClick={() => setModalRegulamentoAberto(false)}
              className="px-4 py-2 bg-brand-bg hover:bg-brand-lilac text-brand-purple border border-brand-lilac-mid rounded-xl text-sm font-semibold transition-colors"
            >
              Fechar Regulamento ×
            </button>
          </header>

          {/* Conteúdo do Regulamento */}
          <main className="flex-1 max-w-[800px] w-full mx-auto px-6 py-8">
            {/* Regra de Tela: Caixa informativa de Objetivo/Instrução */}
            <div className="bg-brand-lilac border border-brand-lilac-mid rounded-2xl p-5 mb-8">
              <h3 className="font-display font-extrabold italic uppercase text-[16px] text-brand-purple-dark mb-1">
                🎯 Informações sobre o Regulamento
              </h3>
              <p className="text-[13px] text-brand-muted leading-relaxed">
                <strong>Objetivo:</strong> Este documento estabelece as regras oficiais, direitos e deveres dos atletas participantes da corrida <strong>INO RUN 2026 — Corrida InoLive</strong>.
                <br />
                <strong>Instruções de Leitura:</strong> Role a página para ler o regulamento completo na íntegra. Todos os participantes estão sujeitos a estas normas ao se inscreverem no evento.
              </p>
            </div>

            {/* Texto do Regulamento */}
            <div className="space-y-6 text-brand-ink text-[14px] leading-relaxed">
              <div className="text-center pb-4 border-b border-brand-lilac-mid">
                <h1 className="font-display font-extrabold italic uppercase text-3xl text-brand-purple">REGULAMENTO OFICIAL DO EVENTO</h1>
                <p className="text-sm text-brand-muted mt-2">INO RUN 2026 — Corrida InoLive · Paraopeba - MG</p>
              </div>

              <section className="space-y-3">
                <h2 className="font-display font-bold text-lg text-brand-purple-dark">CAPÍTULO I – A PROVA</h2>
                <p>
                  <strong>Artigo 1º.</strong> A corrida de rua <strong>INO RUN 2026 — Corrida InoLive</strong> será realizada no domingo, dia <strong>11 de outubro de 2026</strong>, na cidade de Paraopeba - MG, com participação de atletas de ambos os sexos, regularmente inscritos.
                </p>
                <p>
                  <strong>Artigo 2º.</strong> A largada da prova ocorrerá impreterivelmente às <strong>07h00</strong>. Os atletas deverão estar presentes no local de largada com antecedência mínima de 45 minutos, portando o número de peito e o chip de cronometragem oficiais.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display font-bold text-lg text-brand-purple-dark">CAPÍTULO II – DISTÂNCIAS E TEMPOS LIMITES</h2>
                <p>
                  <strong>Artigo 3º.</strong> O evento será constituído por duas modalidades de percursos de corrida de rua:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Prova de 5 km:</strong> Indicada para iniciantes e intermediários, com tempo limite de conclusão estabelecido em 1 hora e 15 minutos.</li>
                  <li><strong>Prova de 10 km:</strong> Voltada a atletas de alta performance e endurance, com tempo limite de conclusão estabelecido em 2 horas.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="font-display font-bold text-lg text-brand-purple-dark">CAPÍTULO III – REGRAS DE INSCRIÇÃO E LOTES</h2>
                <p>
                  <strong>Artigo 4º.</strong> As inscrições serão realizadas exclusivamente pela plataforma online do evento, sendo o limite de vagas fixado em <strong>280 vagas para a prova de 5 km</strong> e <strong>160 vagas para a prova de 10 km</strong>.
                </p>
                <p>
                  <strong>Artigo 5º.</strong> Os valores e prazos de lotes oficiais de inscrição seguem o cronograma abaixo:
                </p>
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-brand-lilac-mid">
                        <th className="p-2.5 text-brand-purple-dark">Modalidade</th>
                        <th className="p-2.5 text-brand-purple-dark">Lote 1</th>
                        <th className="p-2.5 text-brand-purple-dark">Lote 2</th>
                        <th className="p-2.5 text-brand-purple-dark">Lote 3</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-lilac-mid">
                      <tr>
                        <td className="p-2.5 font-semibold">Corrida 5 km</td>
                        <td className="p-2.5">R$ 89,00</td>
                        <td className="p-2.5">R$ 99,00</td>
                        <td className="p-2.5">R$ 109,00</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-semibold">Corrida 10 km</td>
                        <td className="p-2.5">R$ 89,00</td>
                        <td className="p-2.5">R$ 99,00</td>
                        <td className="p-2.5">R$ 109,00</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-semibold">Kids Geral (até 12 · 300m)</td>
                        <td className="p-2.5">R$ 89,00</td>
                        <td className="p-2.5">R$ 99,00</td>
                        <td className="p-2.5">R$ 109,00</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-semibold">Caminhada 5 km</td>
                        <td className="p-2.5">R$ 89,00</td>
                        <td className="p-2.5">R$ 99,00</td>
                        <td className="p-2.5">R$ 109,00</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="text-[12px] text-brand-muted mt-2">* Todos os valores acrescidos de R$ 5,00 de taxa de plataforma por inscrição.</p>
                <p>
                  <strong>Artigo 6º.</strong> O CPF do participante é obrigatório, servindo como identificador único. Não serão permitidas inscrições duplicadas do mesmo CPF no mesmo evento.
                </p>
              </section>


              <section className="space-y-3">
                <h2 className="font-display font-bold text-lg text-brand-purple-dark">CAPÍTULO IV – CATEGORIAS E CRONOMETRAGEM</h2>
                <p>
                  <strong>Artigo 7º.</strong> As categorias de premiação por faixa etária (masculina e feminina) nas distâncias de 5 km e 10 km são baseadas na idade do atleta na data da prova (11/10/2026):
                  <br />
                  <span className="font-semibold block mt-1 text-brand-purple">Sub-20 (13-19 anos) · 20-29 · 30-39 · 40-49 · 50+</span>
                </p>
                <p>
                  <strong>Artigo 7º-A.</strong> A modalidade <strong>Kids Geral</strong> (até 12 anos · <strong>300 metros</strong>) é não-competitiva: todos os participantes que completarem o percurso recebem medalha de participação e sobem ao pódio. Não há classificação por posição nesta categoria.
                </p>
                <p>
                  <strong>Artigo 7º-B.</strong> A modalidade <strong>Caminhada 5 km</strong> (idade livre) é não-cronometrada. <strong>Todos os participantes recebem medalha e sobem ao pódio.</strong> Esta modalidade não integra o ranking geral de corrida.
                </p>
                <p>
                  <strong>Artigo 8º.</strong> O sistema de cronometragem eletrônica será feito por chip descartável fixado ao número de peito. É de responsabilidade do atleta o posicionamento correto do equipamento. A alteração ou ausência do chip desclassificará o competidor nas modalidades cronometradas.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display font-bold text-lg text-brand-purple-dark">CAPÍTULO V – RETIRADA DE KITS</h2>
                <p>
                  <strong>Artigo 9º.</strong> O kit oficial de participação do atleta compreende a camiseta dry-fit técnica exclusiva da prova, sacochila, número de peito e chip de cronometragem.
                </p>
                <p>
                  <strong>Artigo 10.</strong> A entrega de kits ocorrerá na véspera da prova em local e horários divulgados nas mídias oficiais. Para retirada, o atleta deve apresentar documento oficial com foto e o comprovante de pagamento. A retirada por terceiros exige autorização assinada e cópia do documento do titular.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display font-bold text-lg text-brand-purple-dark">CAPÍTULO VI – PREMIAÇÃO</h2>
                <p>
                  <strong>Artigo 11.</strong> Serão premiados com troféus exclusivos:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Os 3 (três) primeiros colocados da classificação Geral (Masculino e Feminino) nas provas de 5 km e 10 km.</li>
                  <li>O 1º (primeiro) colocado de cada Categoria de faixa etária (Masculino e Feminino) nas provas de 5 km e 10 km.</li>
                  <li>Medalha de participação (Finisher) para todos os inscritos que cruzarem a linha de chegada dentro do tempo limite da prova.</li>
                </ul>
              </section>

              <section className="space-y-3 border-t border-brand-lilac-mid pt-4">
                <h2 className="font-display font-bold text-lg text-brand-purple-dark">CAPÍTULO VII – DISPOSIÇÕES FINAIS</h2>
                <p>
                  <strong>Artigo 12.</strong> Ao se inscrever, o atleta assume total responsabilidade pelo seu estado de saúde e condicionamento físico para a prática da modalidade. O evento contará com serviço de atendimento de ambulância de primeiros socorros de plantão.
                </p>
                <p>
                  <strong>Artigo 13.</strong> O atleta autoriza o uso gratuito de sua imagem (fotografias e filmagens da prova) pela organização do evento para fins promocionais e jornalísticos.
                </p>
              </section>

              <div className="text-center pt-8 border-t border-brand-lilac-mid">
                <button 
                  onClick={() => setModalRegulamentoAberto(false)}
                  className="btn-primary px-8 py-3.5 text-sm"
                >
                  Li e Entendi o Regulamento
                </button>
              </div>
            </div>
          </main>
        </div>
      )}

      {/* ── MODAL 2: RESULTADOS (B1 - Consulta Dinâmica + Leaderboard) ── */}
      {modalResultadosAberto && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto flex flex-col">
          {/* Header Fixo do Modal */}
          <header className="sticky top-0 bg-white border-b border-brand-lilac-mid px-6 py-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <Logo height={26} />
              <span className="font-display font-extrabold italic uppercase text-brand-purple text-lg border-l border-brand-lilac-mid pl-3">Resultados Oficiais</span>
            </div>
            <button 
              onClick={() => {
                setModalResultadosAberto(false);
                setTermoBusca('');
                setResultadosBusca([]);
                setRealizouBusca(false);
              }}
              className="px-4 py-2 bg-brand-bg hover:bg-brand-lilac text-brand-purple border border-brand-lilac-mid rounded-xl text-sm font-semibold transition-colors"
            >
              Fechar Resultados ×
            </button>
          </header>

          {/* Conteúdo de Resultados */}
          <main className="flex-1 max-w-[1000px] w-full mx-auto px-6 py-8 space-y-8">
            
            {/* Regra de Tela: Caixa informativa de Objetivo/Instrução */}
            <div className="bg-brand-lilac border border-brand-lilac-mid rounded-2xl p-5">
              <h3 className="font-display font-extrabold italic uppercase text-[16px] text-brand-purple-dark mb-1">
                🏆 Instruções de Busca e Classificação
              </h3>
              <p className="text-[13px] text-brand-muted leading-relaxed">
                <strong>Objetivo:</strong> Consultar os tempos oficiais, ritmo médio (pace) e classificação dos participantes da corrida INO RUN 2026.
                <br />
                <strong>Consulta Individual:</strong> No campo abaixo, digite o seu <strong>Nome completo</strong> ou o seu <strong>Número de Peito (Bib)</strong> e clique em buscar para visualizar sua ficha detalhada de classificação.
                <br />
                <strong>Classificação Completa (Leaderboard):</strong> Role para a seção de ranking para visualizar e filtrar a tabela de posições gerais de cada prova.
              </p>
            </div>

            {/* 1. Busca Dinâmica Individual */}
            <div className="card p-6 space-y-6">
              <h3 className="font-display font-extrabold italic uppercase text-[20px] text-brand-ink">
                Consulta Individual de Tempo
              </h3>
              <form onSubmit={handleBuscaAtleta} className="flex gap-2.5">
                <input
                  type="text"
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  placeholder="Busque por Nome do Atleta ou Número do Peito (Bib)..."
                  className="flex-1 border border-brand-lilac-mid rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-purple bg-brand-bg text-brand-ink"
                />
                <button type="submit" className="btn-primary text-sm px-6 py-3">
                  {loadingBusca ? 'Buscando...' : 'Buscar'}
                </button>
              </form>

              {/* Resultado da Busca */}
              {realizouBusca && (
                <div className="mt-4 space-y-4">
                  {loadingBusca ? (
                    <div className="h-24 bg-brand-lilac rounded-xl animate-pulse flex items-center justify-center text-brand-muted text-sm">
                      Buscando atleta no banco de dados...
                    </div>
                  ) : resultadosBusca.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {resultadosBusca.map((atleta) => (
                        <div key={atleta.id} className="border border-brand-purple-mid bg-brand-lilac rounded-2xl p-5 shadow-sm space-y-4">
                          <div className="flex items-center justify-between border-b border-brand-lilac-mid pb-3">
                            <div>
                              <span className="inline-flex px-2 py-0.5 bg-brand-purple text-white font-display font-extrabold italic uppercase text-[12px] rounded-md mr-2">
                                {atleta.distancia_km}K
                              </span>
                              <span className="text-xs text-brand-muted font-semibold">Dorsal #{atleta.bib_number}</span>
                            </div>
                            <span className="font-display font-extrabold text-[22px] text-brand-purple">
                              {atleta.colocacao_geral}º Geral
                            </span>
                          </div>
                          
                          <h4 className="font-display font-bold uppercase text-[18px] text-brand-ink leading-tight">
                            {atleta.nome}
                          </h4>

                          <div className="grid grid-cols-2 gap-4 text-xs border-b border-brand-lilac-mid pb-3">
                            <div>
                              <span className="text-brand-muted block uppercase tracking-wider font-semibold">Tempo Líquido</span>
                              <span className="font-display font-extrabold text-[24px] text-brand-purple-dark">{atleta.tempo_liquido}</span>
                            </div>
                            <div>
                              <span className="text-brand-muted block uppercase tracking-wider font-semibold">Tempo Bruto</span>
                              <span className="font-display font-bold text-[20px] text-brand-ink">{atleta.tempo_bruto}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-center text-[12px]">
                            <div className="bg-white rounded-lg p-2 border border-brand-lilac-mid">
                              <span className="text-brand-muted block font-semibold">Pace</span>
                              <span className="font-bold text-brand-ink text-sm">{atleta.pace} /km</span>
                            </div>
                            <div className="bg-white rounded-lg p-2 border border-brand-lilac-mid">
                              <span className="text-brand-muted block font-semibold">Pos Categoria</span>
                              <span className="font-bold text-brand-ink text-sm">{atleta.colocacao_categoria}º</span>
                              <span className="text-[10px] text-brand-muted block font-mono">{atleta.categoria}</span>
                            </div>
                            <div className="bg-white rounded-lg p-2 border border-brand-lilac-mid">
                              <span className="text-brand-muted block font-semibold">Pos Sexo ({atleta.sexo})</span>
                              <span className="font-bold text-brand-ink text-sm">{atleta.colocacao_sexo}º</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-brand-bg border border-brand-lilac-mid rounded-xl p-6 text-center text-sm text-brand-muted">
                      Nenhum atleta ou classificação encontrada para a busca "{termoBusca}". Verifique se digitou o número ou nome corretamente.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Leaderboard Geral */}
            <div className="card p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-brand-lilac-mid pb-4">
                <div>
                  <h3 className="font-display font-extrabold italic uppercase text-[20px] text-brand-ink">
                    Classificação Geral & Categorias
                  </h3>
                  <p className="text-xs text-brand-muted mt-0.5">Explore e filtre o ranking completo dos corredores</p>
                </div>
                
                {/* Abas de Distância */}
                <div className="flex bg-brand-bg p-1 rounded-xl border border-brand-lilac-mid">
                  <button
                    onClick={() => {
                      setDistanciaLeaderboard(5);
                      setCategoriaFiltro('Todos');
                    }}
                    className={`px-4 py-2 font-display font-extrabold italic uppercase text-[14px] rounded-lg transition-all ${distanciaLeaderboard === 5 ? 'bg-brand-purple text-white shadow-sm' : 'text-brand-muted hover:text-brand-ink'}`}
                  >
                    5 KM
                  </button>
                  <button
                    onClick={() => {
                      setDistanciaLeaderboard(10);
                      setCategoriaFiltro('Todos');
                    }}
                    className={`px-4 py-2 font-display font-extrabold italic uppercase text-[14px] rounded-lg transition-all ${distanciaLeaderboard === 10 ? 'bg-brand-purple text-white shadow-sm' : 'text-brand-muted hover:text-brand-ink'}`}
                  >
                    10 KM
                  </button>
                </div>
              </div>

              {/* Filtros de Ranking */}
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-[11px] text-brand-muted block font-semibold uppercase tracking-wider mb-1">Filtrar por Nome / Bib</label>
                  <input
                    type="text"
                    value={filtroNomeLeaderboard}
                    onChange={(e) => setFiltroNomeLeaderboard(e.target.value)}
                    placeholder="Filtrar por nome ou peito na lista..."
                    className="border border-brand-lilac-mid rounded-lg px-3 py-2 text-xs w-full bg-brand-bg text-brand-ink focus:outline-none focus:border-brand-purple"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-brand-muted block font-semibold uppercase tracking-wider mb-1">Filtrar por Categoria</label>
                  <select
                    value={categoriaFiltro}
                    onChange={(e) => setCategoriaFiltro(e.target.value)}
                    className="border border-brand-lilac-mid rounded-lg px-3 py-2 text-xs bg-brand-bg text-brand-ink focus:outline-none focus:border-brand-purple"
                  >
                    {/* Dinâmico: categorias derivadas dos resultados carregados do banco */}
                    {categoriasDisponiveis.map(cat => (
                      <option key={cat} value={cat}>
                        {cat === 'Todos' ? 'Todas as Categorias' : cat}
                      </option>
                    ))}
                    {/* Fallback estático quando não há resultados ainda */}
                    {categoriasDisponiveis.length <= 1 && (
                      <>
                        <option value="M Sub-20">Masculino Sub-20</option>
                        <option value="F Sub-20">Feminino Sub-20</option>
                        <option value="M 20-29">Masculino 20-29</option>
                        <option value="F 20-29">Feminino 20-29</option>
                        <option value="M 30-39">Masculino 30-39</option>
                        <option value="F 30-39">Feminino 30-39</option>
                        <option value="M 40-49">Masculino 40-49</option>
                        <option value="F 40-49">Feminino 40-49</option>
                        <option value="M 50+">Masculino 50+</option>
                        <option value="F 50+">Feminino 50+</option>
                        <option value="Kids Geral">Kids Geral</option>
                        <option value="Caminhada">Caminhada</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Tabela de Ranking */}
              {loadingLeaderboard ? (
                <div className="h-48 bg-brand-lilac rounded-xl animate-pulse flex items-center justify-center text-brand-muted text-sm">
                  Carregando lista de classificação oficial...
                </div>
              ) : leaderboardFiltrado.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-brand-lilac-mid">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-brand-lilac text-brand-purple font-display font-bold uppercase border-b border-brand-lilac-mid">
                        <th className="p-3">Posição</th>
                        <th className="p-3">Bib</th>
                        <th className="p-3">Nome</th>
                        <th className="p-3">Sexo</th>
                        <th className="p-3">Categoria</th>
                        <th className="p-3">Pos Cat</th>
                        <th className="p-3">Tempo Líquido</th>
                        <th className="p-3">Pace</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-lilac-mid bg-white">
                      {leaderboardFiltrado.map((row) => (
                        <tr key={row.id} className="hover:bg-brand-bg transition-colors">
                          <td className="p-3 font-semibold text-brand-ink">{row.colocacao_geral}º</td>
                          <td className="p-3">#{row.bib_number}</td>
                          <td className="p-3 font-medium text-brand-ink">{row.nome}</td>
                          <td className="p-3">{row.sexo}</td>
                          <td className="p-3 font-mono">{row.categoria}</td>
                          <td className="p-3">{row.colocacao_categoria}º</td>
                          <td className="p-3 font-semibold text-brand-purple">{row.tempo_liquido}</td>
                          <td className="p-3 font-mono">{row.pace} /km</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-brand-bg border border-brand-lilac-mid rounded-xl p-12 text-center space-y-2">
                  <span className="text-3xl block">🏆</span>
                  <h4 className="font-display font-extrabold italic uppercase text-brand-purple-dark text-[16px]">Aguardando Classificação Oficial</h4>
                  <p className="text-xs text-brand-muted max-w-sm mx-auto leading-relaxed">
                    Os resultados oficiais de cronometragem da prova de <strong>{distanciaLeaderboard} km</strong> estarão disponíveis nesta seção logo após a apuração no dia do evento (11/10/2026).
                  </p>
                </div>
              )}
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
