/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './src/app/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff1f2',
          100: '#ffe4e6',
          400: '#ff252d',
          500: '#f20d18',
          600: '#c9000d',
          700: '#b4000a',
          800: '#8f0008',
          900: '#700008'
        },
        surface: {
          50: '#050505',
          100: '#171717',
          200: '#262626',
          300: '#8a8a8a',
          400: '#cfcfcf',
          500: '#e8e8e8',
          600: '#f5f5f5',
          700: '#ffffff',
        }
      }
    }
  },
  plugins: []
};
