/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // dark: mengikuti pilihan tema di ATLAS (bukan setelan gelap/terang perangkat)
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Helvetica', 'Arial', 'sans-serif'], display: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Helvetica', 'Arial', 'sans-serif'] },
      colors: {
        ink: { DEFAULT: '#141B34', soft: '#4A4F6A', mute: '#5E6380' },
        brand: { DEFAULT: '#4f46e5', dark: '#4338ca', soft: '#eef1ff' },
        accent: { DEFAULT: '#06b6d4', soft: '#ecfeff' },
        pop: { DEFAULT: '#d946ef', soft: '#fdf4ff' },
        paper: '#F3F4F9',
      },
      boxShadow: {
        card: '0 1px 2px rgba(20,27,52,0.04)',
        glow: '0 8px 24px -8px rgba(79,70,229,0.55)',
      },
      borderRadius: { '2.5xl': '1.25rem' },
    },
  },
  plugins: [],
}
