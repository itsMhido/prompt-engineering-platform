/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0f',
        panel: '#12121a',
        border: '#2a2a35',
        primary: {
          DEFAULT: '#00f0ff', // electric teal
          dark: '#00d5e6',
          hover: 'rgba(0, 240, 255, 0.1)',
        },
        text: {
          main: '#e2e8f0',
          muted: '#94a3b8',
        }
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
