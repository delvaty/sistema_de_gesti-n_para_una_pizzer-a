/** @type {import('tailwindcss').Config} */
import { fontFamily } from 'tailwindcss/defaultTheme';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FF6B35',
        secondary: '#F7C59F',
        background: '#1A1A1A',
        surface: '#2A2A2A',
        text: '#FFFFFF',
        'text-secondary': '#A3A3A3',
        accent: '#4ECDC4',
        border: '#3A3A3A',
      },
      fontFamily: {
        sans: ['Inter', ...fontFamily.sans],
        serif: ['Playfair Display', ...fontFamily.serif],
      },
      borderRadius: {
        'lg': '1rem',
        'xl': '1.5rem',
      },
      boxShadow: {
        'glow': '0 0 20px 5px rgba(255, 107, 53, 0.3)',
      }
    },
  },
  plugins: [],
}
