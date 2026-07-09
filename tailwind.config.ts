import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b0b0f',
        panel: '#141419',
        edge: '#26262f',
        accent: '#34d399',
        'accent-dim': '#10b981',
      },
    },
  },
  plugins: [],
};

export default config;
