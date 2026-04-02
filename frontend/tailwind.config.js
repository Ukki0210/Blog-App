/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        cream: {
          50: '#faf9f6',
          100: '#f5f2ec',
          200: '#ebe5d8',
          300: '#ddd4c0',
          400: '#c9ba9e',
          500: '#b5a07c',
        },
        sage: {
          400: '#8a9e87',
          500: '#728a6e',
          600: '#5c7258',
        },
        charcoal: {
          800: '#2a2825',
          900: '#1a1815',
        }
      },
      typography: {
        DEFAULT: {
          css: {
            fontFamily: '"DM Sans", system-ui, sans-serif',
          }
        }
      }
    }
  },
  plugins: []
}
