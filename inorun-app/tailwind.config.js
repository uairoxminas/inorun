/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Brand palette (INO RUN 2026 — Canva DAHGThc6ebU) ──
        brand: {
          purple:        '#8417AE',   // primário
          'purple-dark': '#5B0E7A',   // escuro
          'purple-mid':  '#A93FD0',   // médio/hover
          yellow:        '#FFD200',   // acento vibrante
          'yellow-dk':   '#E8B800',   // amarelo hover/realce
          lilac:         '#F2E6F8',   // fundo suave
          'lilac-mid':   '#ECE0F2',   // borda/linha
          bg:            '#FBF7FD',   // fundo de página
          ink:           '#26122E',   // texto primário
          muted:         '#6E5E76',   // texto secundário
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Saira Condensed', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'hero':    ['clamp(72px,17vw,168px)', { lineHeight: '0.82', letterSpacing: '-0.01em' }],
        'section': ['clamp(32px,6vw,52px)',   { lineHeight: '0.95' }],
        'card-km': ['56px',                    { lineHeight: '1' }],
      },
      backgroundImage: {
        'gradient-brand':    'linear-gradient(135deg, #5B0E7A 0%, #8417AE 100%)',
        'gradient-brand-h':  'linear-gradient(90deg, #8417AE 0%, #A93FD0 45%, #FFD200 100%)',
        'gradient-countdown':'linear-gradient(160deg, #8417AE, #5B0E7A)',
      },
      boxShadow: {
        brand:  '0 8px 30px rgba(132,23,174,0.10)',
        'brand-lg': '0 16px 48px rgba(132,23,174,0.18)',
        yellow: '0 4px 16px rgba(255,210,0,0.40)',
      },
      borderRadius: {
        '2xl': '18px',
        '3xl': '24px',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease forwards',
      },
    },
  },
  plugins: [],
}
