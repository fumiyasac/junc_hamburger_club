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
        // Hamburger-shop palette: ketchup red / mustard yellow / lettuce green / toasted-bun brown / cream
        primary:          '#C8102E', // ketchup red
        'primary-dark':   '#8E0B20',
        'primary-light':  '#FDE4E8',
        secondary:        '#F5B700', // mustard yellow
        'secondary-dark': '#C99100',
        accent:           '#4F8A3F', // lettuce green
        bun:              '#B06B2A', // toasted-bun brown
        'bun-dark':       '#7A4718',
        background:       '#FFF8EC', // cream
      },
      fontFamily: {
        sans: ['Nunito', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
