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
        }
      }
    },
  },
  plugins: [],
}
