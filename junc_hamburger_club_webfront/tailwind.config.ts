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
        primary:    '#FF6B6B',
        secondary:  '#FFD93D',
        accent:     '#6BCB77',
        background: '#FFF8F8',
        'primary-dark':  '#E05555',
        'primary-light': '#FFE0E0',
      },
      fontFamily: {
        sans: ['Nunito', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
