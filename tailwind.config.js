/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'], display: ['Sora', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'] },
      colors: {
        ink: { DEFAULT: '#0e1540', soft: '#3f4a73', mute: '#7a85a8' },
        brand: { DEFAULT: '#4f46e5', dark: '#4338ca', soft: '#eef1ff' },
        accent: { DEFAULT: '#06b6d4', soft: '#ecfeff' },
        pop: { DEFAULT: '#d946ef', soft: '#fdf4ff' },
        paper: '#f4f6fc',
      },
      boxShadow: {
        card: '0 1px 2px rgba(14,21,64,0.04), 0 8px 24px -12px rgba(79,70,229,0.18)',
        glow: '0 8px 24px -8px rgba(79,70,229,0.55)',
      },
      borderRadius: { '2.5xl': '1.25rem' },
    },
  },
  plugins: [],
}
