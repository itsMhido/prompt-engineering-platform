/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0f0e0d',
        panel: '#1a1916',
        border: '#252320',
        primary: {
          DEFAULT: '#88d273ff', // warm amber/gold
          dark: '#588a4bff',
          hover: 'rgba(232, 168, 71, 0.1)',
        },
        text: {
          main: '#f0ece4',
          muted: '#8a8478',
        }
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
