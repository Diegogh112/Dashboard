/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bn: {
          dark: '#0F2D5B', // Azul marino oscuro
          primary: '#1565C0', // Azul medio
          light: '#F4F6F9', // Gris claro de fondo
          gray: '#546E7A',
          orange: '#F57C00',
          green: '#2E7D32',
          red: '#C62828',
        }
      }
    },
  },
  plugins: [],
}
