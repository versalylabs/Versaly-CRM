/** @type {import('tailwindcss').Config} */
const WARM = {
  50: '#fffbf2',
  100: '#fcf5e6',
  200: '#f8edd2', // VersalyLabs Cream
  300: '#f2d9aa',
  400: '#ff8f45',
  500: '#ff6b01', // VersalyLabs Orange
  600: '#e85f00',
  700: '#c24e00',
  800: '#933c04',
  900: '#5e2805',
  950: '#082a2b',
};

module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // VersalyLabs brand palette: ink #051f20, cream #f8edd2, orange #ff6b01.
        // To re-colour the product, change these values (and the matching ones in globals.css).
        brand: {
          orange: '#ff6b01',
          cream: '#f8edd2',
          ink: '#051f20',
        },
        // Dark surfaces derived from the brand ink (950 = deepest, 500 = borders).
        ink: {
          950: '#021213',
          900: '#031819',
          850: '#051f20',
          800: '#0a2a2b',
          700: '#0f3536',
          600: '#164142',
          500: '#1f4f50',
        },
        // Legacy palette names used across the UI, mapped to the brand: light shades are cream, mid shades orange.
        sky: WARM,
        cyan: WARM,
        accent: WARM,
        primary: {
          50: '#fffbf2',
          100: '#fcf5e6',
          200: '#f8edd2',
          300: '#f2d9aa',
          400: '#ff8f45',
          500: '#ff6b01',
          600: '#e85f00',
          700: '#0f3536',
          800: '#051f20',
          900: '#031819',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        // Brand font (logo, headings)
        heading: ['var(--font-quicksand)', 'Quicksand', 'system-ui', 'sans-serif'],
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