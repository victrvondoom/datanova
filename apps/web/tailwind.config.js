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
        navy: {
          950: '#060a18',
          900: '#0b132b',
          800: '#1c2541',
          700: '#3a506b',
        },
        accent: {
          teal: '#00b4d8',
          cyan: '#90e0ef',
          emerald: '#10b981',
          rose: '#f43f5e',
          amber: '#f59e0b',
          violet: '#8b5cf6',
        }
      },
      fontFamily: {
        display: ['Outfit', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'glow-teal': '0 0 24px -6px rgba(0, 180, 216, 0.45)',
        'glow-emerald': '0 0 24px -6px rgba(16, 185, 129, 0.45)',
        'glow-violet': '0 0 24px -6px rgba(139, 92, 246, 0.45)',
        'card-ultra': '0 8px 32px -8px rgba(2, 6, 23, 0.55), inset 0 1px 0 0 rgba(255, 255, 255, 0.06)',
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
