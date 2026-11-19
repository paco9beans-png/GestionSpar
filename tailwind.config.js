/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Figtree', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Figtree', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#1f8a4c',
          foreground: '#ffffff',
          soft: '#e3f3e9',
        },
        secondary: {
          DEFAULT: '#f0f2ee',
          foreground: '#3a4038',
        },
        accent: {
          DEFAULT: '#e8a020',
          foreground: '#3a2c05',
        },
        background: '#f7f8f6',
        card: '#ffffff',
        foreground: '#22271f',
        muted: '#eef0ea',
        'muted-foreground': '#6b7367',
        border: '#e3e6de',
        destructive: '#d64545',
        'destructive-foreground': '#ffffff',
      },
      boxShadow: {
        card: '0 1px 2px rgba(24,40,28,0.05), 0 4px 14px rgba(24,40,28,0.06)',
        float: '0 10px 30px rgba(31,138,76,0.28)',
      },
      backgroundImage: {
        hero: 'linear-gradient(135deg, #27a35c 0%, #1f8a4c 55%, #156f3c 100%)',
      },
    },
  },
  plugins: [],
};
