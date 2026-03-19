/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        app: '#0b0f14',
        panel: '#141a22',
        ink: '#e6edf3',
        accent: '#ff6b3d',
        border: '#222a36',
      },
    },
  },
  plugins: [],
}
