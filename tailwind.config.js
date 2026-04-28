/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Helvetica', 'Arial', 'sans-serif'],
        mono: ['Courier New', 'monospace'],
      },
      colors: {
        notebook: {
          bg: '#0B090F',        // Very dark purple-black
          sidebar: '#140F1D',   // Dark purple sidebar
          cell: '#1D152A',      // Slightly lighter purple cell
          cellBorder: '#352554',// Purple border
          text: '#E2D8F0',      // Light purple/white text
          textMuted: '#9480B3', // Muted purple text
          accent: '#A855F7',    // Vibrant purple
        }
      },
      animation: {
        fadeIn: 'fadeIn 0.2s ease-in-out',
        'progress-indeterminate': 'progress 2s infinite linear',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        progress: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' }
        }
      }
    }
  },
  plugins: [],
}
