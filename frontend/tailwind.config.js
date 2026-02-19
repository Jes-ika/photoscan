/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // University theme: Deep Red (primary), Navy Blue (secondary)
        primary: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#dc2626',
          600: '#b91c1c',
          700: '#991b1b',
          800: '#7f1d1d',
          900: '#6b1515',
          950: '#450a0a',
          DEFAULT: '#8B1538', // Deep Crimson Red - university primary
        },
        navy: {
          50: '#e8eaef',
          100: '#d1d5df',
          200: '#a3abbf',
          300: '#7681a0',
          400: '#485780',
          500: '#1a2d60',
          600: '#15244d',
          700: '#101b3a',
          800: '#0b1226',
          900: '#050913',
          DEFAULT: '#1a2d60', // Navy Blue - university secondary
        },
        accent: {
          red: '#8B1538',
          navy: '#1a2d60',
          gold: '#c9a227',
        },
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        display: ['Clash Display', 'Outfit', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
        'card': '0 4px 24px -1px rgba(139, 21, 56, 0.08), 0 2px 8px -2px rgba(139, 21, 56, 0.04)',
        'card-hover': '0 20px 40px -4px rgba(139, 21, 56, 0.12), 0 8px 16px -4px rgba(26, 45, 96, 0.08)',
        'inner-glow': 'inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
      },
    },
  },
  plugins: [],
}
