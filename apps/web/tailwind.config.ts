import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        hv: {
          green: '#2f4f39',
          'green-hover': '#3d6b4a',
          gray: '#646464',
          page: '#faf7f2',
          card: '#ffffff',
          border: '#e0e0e0',
          'border-input': '#dbdad9',
          crisis: '#c0392b',
          accent: '#637dff',
          charcoal: '#1A1A1A',
          sage: '#7A8B76',
          terracotta: '#C27D5F',
          'terracotta-hover': '#a8694e',
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
