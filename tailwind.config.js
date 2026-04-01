/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Segoe UI Variable"', '"Segoe UI"', 'Tahoma', 'Verdana', 'sans-serif'],
        display: ['"Cascadia Code"', 'Consolas', 'monospace'],
      },
      colors: {
        base: 'hsl(var(--bg))',
        'base-soft': 'hsl(var(--bg-soft))',
        panel: 'hsl(var(--panel))',
        'panel-strong': 'hsl(var(--panel-strong))',
        text: 'hsl(var(--text))',
        muted: 'hsl(var(--muted))',
        accent: 'hsl(var(--accent))',
        'accent-strong': 'hsl(var(--accent-strong))',
        border: 'hsl(var(--border))',
      },
      boxShadow: {
        soft: '0 10px 30px -18px rgba(15, 23, 42, 0.35)',
        glow: '0 0 0 1px hsl(var(--border)), 0 10px 30px -10px rgba(30, 64, 175, 0.35)',
      },
    },
  },
  plugins: [],
}
