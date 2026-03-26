import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        dyn: {
          DEFAULT: '#0078D4',
          dark:    '#005A9E',
          light:   '#EFF6FC',
          50:      '#F3F9FE',
          100:     '#D0E7F8',
        },
        col: {
          green:  '#00A550',
          gray:   '#F3F2F1',
          border: '#EDEBE9',
          text:   '#323130',
          muted:  '#605E5C',
        },
      },
      boxShadow: {
        card: '0 1.6px 3.6px rgba(0,0,0,0.13), 0 0.3px 0.9px rgba(0,0,0,0.11)',
        'card-hover': '0 3.2px 7.2px rgba(0,0,0,0.13), 0 0.6px 1.8px rgba(0,0,0,0.11)',
      },
    },
  },
  plugins: [],
}
export default config
