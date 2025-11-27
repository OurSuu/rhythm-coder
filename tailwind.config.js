/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          'neon-blue': '#00f3ff',
          'neon-pink': '#ff00ff',
          'neon-green': '#00ff9f',
          'dark-bg': '#050510',
        },
        animation: {
          'spin-slow': 'spin 3s linear infinite',
        }
      },
    },
    plugins: [],
  }