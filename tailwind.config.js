/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.html"],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Playfair Display"', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        forest: {
          50: '#f2f7f4',
          100: '#e1ede6',
          200: '#c5dbce',
          500: '#609a7b',
          600: '#498062',
          700: '#3a664e',
          800: '#2f523f',
          900: '#1d3327',
          950: '#0f1c15',
        },
        soil: {
          50: '#faf8f5',
          100: '#f4efe9',
          200: '#e5dbcd',
          300: '#cfbeaa',
          800: '#43372c',
          900: '#2b231b',
        },
      }
    }
  },
  plugins: [],
}
