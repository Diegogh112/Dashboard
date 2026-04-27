/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        corporate: {
          dark: '#1e3a5f',
          DEFAULT: '#1e3a5f',
          light: '#334e68',
        }
      }
    },
  },
  plugins: [],
}
