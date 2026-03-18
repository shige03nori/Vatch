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
        vatch: {
          bg:            '#060d1a',
          surface:       '#080f1e',
          border:        '#0f2444',
          'border-light': '#1e3a5f',
          cyan:          '#38bdf8',
          green:         '#4ade80',
          amber:         '#f59e0b',
          red:           '#f87171',
          purple:        '#a78bfa',
          muted:         '#64748b',
          'muted-dark':  '#334155',
          text:          '#e2e8f0',
          'text-bright': '#f1f5f9',
          'text-dim':    '#94a3b8',
        },
      },
    },
  },
  plugins: [],
}
export default config
