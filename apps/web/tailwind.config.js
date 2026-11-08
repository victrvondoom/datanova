/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* Inherited from moa's "Meadow" palette (vultr/moa-main src/app/globals.css):
           zinc-neutral surfaces, grass green (#5aac45) as primary, stem green
           (#3a7f2c) for links/gradients, pale meadow tint (#ecf6e6) for accents.
           navy-* now maps moa's dark neutral ramp (near-black #0a0a0b, card
           #1c1c1e, hairline #2b2b2e) so dark mode matches moa's dark tokens. */
        navy: {
          950: '#050505',
          900: '#0a0a0b',
          800: '#1c1c1e',
          700: '#2b2b2e',
        },
        accent: {
          teal: '#5aac45',   // moa --primary (grass)
          cyan: '#d9e585',   // moa --brand-ink dark (pale stem — accent on dark)
          emerald: '#34d399',
          rose: '#f43f5e',
          amber: '#f59e0b',
          violet: '#3a7f2c', // moa --brand-ink (stem green, gradient depth)
        },
        meadow: {
          DEFAULT: '#5aac45',
          soft: '#ecf6e6',
          ink: '#3a7f2c',
          dark: '#d9e585',
        },
        cream: {
          50: '#fdfcf9',
          100: '#faf7f2',
          200: '#f4eee2',
          300: '#ebe2d0',
          400: '#dfd2bc',
          500: '#c5b08e',
          600: '#a6906d',
          700: '#877251',
          800: '#6d5a3d',
          900: '#4b3c26',
        },
        creamblack: {
          950: '#121110',
          900: '#181716',
          800: '#22201d',
          700: '#2e2b26',
          600: '#3d3933',
          500: '#575249',
        },
        gold: {
          DEFAULT: '#c59b27',
          light: '#dfba49',
          shimmer: '#edd685',
          dark: '#9a7516',
        },
      },
      fontFamily: {
        display: ['Geist', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
        cursive: ['Caveat', 'Playfair Display', 'cursive', 'serif'],
        editorial: ['Playfair Display', 'Georgia', 'serif'],
      },
      boxShadow: {
        'glow-teal': '0 0 0 1px rgba(90, 172, 69, 0.22), 0 8px 24px -12px rgba(90, 172, 69, 0.35)',
        'glow-emerald': '0 0 0 1px rgba(52, 211, 153, 0.22), 0 8px 24px -12px rgba(52, 211, 153, 0.35)',
        'glow-violet': '0 0 0 1px rgba(58, 127, 44, 0.22), 0 8px 24px -12px rgba(58, 127, 44, 0.35)',
        'card-ultra': '0 1px 2px rgba(9, 9, 11, 0.04), 0 8px 24px -16px rgba(9, 9, 11, 0.12)',
      },
      animation: {
        'aurora': 'aurora-drift 22s ease-in-out infinite alternate',
        'float': 'float-slow 7s ease-in-out infinite',
        'shimmer': 'shimmer-sweep 2.4s linear infinite',
        'fade-up': 'fade-up 0.55s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
      keyframes: {
        'aurora-drift': {
          '0%': { transform: 'translate3d(-4%, -2%, 0) scale(1)' },
          '50%': { transform: 'translate3d(3%, 2%, 0) scale(1.08)' },
          '100%': { transform: 'translate3d(-2%, 4%, 0) scale(1.04)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'shimmer-sweep': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-up': {
          'from': { opacity: '0', transform: 'translateY(14px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
