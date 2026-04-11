import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Material UI palette inspired by theme.js
        primary: '#a2466c',
        secondary: '#f7f0eb',
        accent: '#535353',
        'palette-blue': '#789bc5',
        'palette-green': '#b0bf74',
        'palette-yellow': '#ddb763',
        'palette-orange': '#d58b5f',
        'palette-red': '#c4736e',
        'palette-purple': '#9e88aa',
      },
      backgroundColor: {
        'balloon': 'rgba(0, 0, 0, 0.8)',
      },
    },
  },
  plugins: [],
};

export default config;
