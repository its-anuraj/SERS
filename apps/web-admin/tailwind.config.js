/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'sans-serif'] },
      colors: {
        sers: {
          bg: '#0a0e1a',
          card: '#1a2235',
          red: '#ef4444',
          orange: '#f97316',
          green: '#22c55e',
          blue: '#3b82f6',
        },
      },
    },
  },
  plugins: [],
};
