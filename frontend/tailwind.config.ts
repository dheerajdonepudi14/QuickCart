import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: { DEFAULT: '1rem', lg: '1.5rem' }, screens: { '2xl': '1240px' } },
    extend: {
      colors: {
        brand: {
          DEFAULT: '#22A04B',
          50: '#EEF6EE',
          100: '#E8F3E6',
          200: '#CFE8D2',
          300: '#9FD2A9',
          400: '#4DB86B',
          500: '#22A04B',
          600: '#1C8C40',
          700: '#1C7C3B',
          800: '#176330',
        },
        mint: '#EEF6EE',
        hero: '#E8F3E6',
        cream: '#F7F1EA',
        sky: '#A6E3EA',
        lime: '#E4EFB5',
        sand: '#F2D7A6',
        ink: { DEFAULT: '#1D1D1F', soft: '#4A4A4F', muted: '#8A8A90' },
        line: '#ECECEC',
        danger: '#E53935',
        star: '#F5B400',
      },
      fontFamily: {
        display: ['Raleway', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Mulish', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,16,0.04), 0 4px 14px rgba(16,24,16,0.05)',
        lift: '0 10px 30px rgba(16,40,20,0.10)',
      },
      keyframes: {
        'slide-in': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop': { '0%': { transform: 'scale(0.9)' }, '60%': { transform: 'scale(1.05)' }, '100%': { transform: 'scale(1)' } },
        'ping-slow': { '0%': { transform: 'scale(1)', opacity: '0.6' }, '100%': { transform: 'scale(2.6)', opacity: '0' } },
        'float': { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
      },
      animation: {
        'slide-in': 'slide-in 0.28s cubic-bezier(.2,.8,.2,1)',
        'fade-in': 'fade-in 0.2s ease-out',
        pop: 'pop 0.25s ease-out',
        'ping-slow': 'ping-slow 2s cubic-bezier(0,0,.2,1) infinite',
        float: 'float 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
