/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Versaly Official Brand Palette (#14213d, #e5e5e5, #fca311)
        versaly: {
          navy: '#14213d',
          platinum: '#e5e5e5',
          gold: '#fca311',
          amber: '#fca311',
          card: '#1b2a4a',
          surface: '#16233f',
          input: '#0e172a',
          border: '#243862',
          hover: '#203358',
        },
        primary: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#fca311', // Signature Versaly Gold Accent
          600: '#e5940f',
          700: '#1b2a4a',
          800: '#14213d', // Versaly Brand Navy
          900: '#0e172a',
        },
        accent: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#fca311', // Versaly Gold
          600: '#e5940f',
          700: '#d97706',
          800: '#b45309',
          900: '#78350f',
        },
        // Harmonize sky & cyan with Versaly's warm gold / amber signature accent
        sky: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#fca311', // Versaly Gold Accent
          600: '#e5940f',
          700: '#d97706',
          800: '#b45309',
          900: '#78350f',
          950: '#451a03',
        },
        cyan: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fca311', // Versaly Gold
          500: '#e5940f',
          600: '#d97706',
          700: '#b45309',
          800: '#78350f',
          900: '#451a03',
          950: '#291002',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          'sans-serif'
        ],
        heading: [
          'Glorase',
          'var(--font-glorase)',
          'Georgia',
          'Cambria',
          'serif'
        ],
        glorase: [
          'Glorase',
          'var(--font-glorase)',
          'Georgia',
          'Cambria',
          'serif'
        ],
        serif: [
          'Glorase',
          'var(--font-glorase)',
          'Georgia',
          'Cambria',
          'serif'
        ],
      },
      borderRadius: {
        lg: '0.5rem',
        xl: '0.75rem',
      },
      boxShadow: {
        soft: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        medium: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      },
      animation: {
        spotlight: 'spotlight 2s ease .75s 1 forwards',
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        spotlight: {
          '0%': {
            opacity: '0',
            transform: 'translate(-72%, -62%) scale(0.5)',
          },
          '100%': {
            opacity: '1',
            transform: 'translate(-50%,-40%) scale(1)',
          },
        },
      },
    },
  },
  plugins: [],
}