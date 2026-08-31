/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    // Mirrors src/styles/breakpoints.js and the scale documented at the top of
    // src/styles/tokens.css. Tailwind's defaults (sm 640 / md 768 / lg 1024 /
    // xl 1280 / 2xl 1536) agreed with ours everywhere except the top step and
    // had no xs, so `sm:` in a class meant something different from `sm` in the
    // hooks. Declared in full rather than extended so no default leaks back in.
    screens: {
      xs: '480px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1440px',
    },
    extend: {
      fontFamily: {
        sans: [
          'Hubot Sans',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      colors: {
        // Add custom colors from your design system
        background: '#171717',
        dot: '#171E43',
        gradient: 'var(--gradient)',
      },
    },
  },
  plugins: [],
};
