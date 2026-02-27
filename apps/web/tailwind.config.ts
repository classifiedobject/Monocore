import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mono: {
          50: '#f8fafc',
          100: '#eef2ff',
          500: '#1d4ed8',
          700: '#1e3a8a'
        }
      }
    }
  },
  plugins: []
} satisfies Config;
