import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Hamburger-shop palette: appetizing orange + tomato red accent + lettuce green + toasted-bun brown + warm cream
        primary:          '#EA580C', // appetizing grill orange
        'primary-dark':   '#9A3412',
        'primary-light':  '#FFEDD5',
        secondary:        '#DC2626', // tomato / ketchup red (accent, not a flood color)
        'secondary-dark': '#991B1B',
        accent:           '#65A30D', // fresh lettuce green
        bun:              '#92400E', // toasted-bun brown
        'bun-dark':       '#5C2E0C',
        background:       '#FFF8F1', // warm cream
      },
      fontFamily: {
        sans: ['Nunito', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
