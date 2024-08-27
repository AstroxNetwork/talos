/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1668dc',
        'primary-op10': 'rgba(22,104,220,0.1)',
        soft: '#9c9ca4',
      },
      fontFamily: {
        nova: ['Nova', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
