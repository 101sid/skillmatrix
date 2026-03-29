/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: '#4FD1C5',
          darkTeal: '#38B2AC',
          blue: '#3182CE',
          navy: '#2D3748',
          yellow: '#F6C90E',
          red: '#F5385A'
        }
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      }
    },
  },
  plugins: [],
}