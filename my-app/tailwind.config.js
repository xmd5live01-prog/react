/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: { deep: '#1c1e21', sea: '#0755d4', aqua: '#0866ff', sun: '#0866ff' },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        display: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      keyframes: {
        ring: { '0%,100%': { transform: 'scale(.96)', opacity: '.9' }, '50%': { transform: 'scale(1.05)', opacity: '.35' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-12px)' } },
        rise: { to: { transform: 'translateY(-110vh)' } },
        drift: { to: { transform: 'translateX(-5%) scaleX(1.1)' } },
      },
      animation: {
        ring: 'ring 4s ease-in-out infinite',
        float: 'float 5s ease-in-out infinite',
        rise: 'rise 9s linear infinite',
        drift: 'drift 9s ease-in-out infinite alternate',
      },
    },
  },
};
