import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Restrained, trustworthy palette. Single accent colour (warm red),
        // monochrome neutrals, no rainbow. Matches the Jashore Blood Network
        // architecture plan and the Bangla donor app reference screenshot.
        brand: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#dc2626', // primary accent
          600: '#b91c1c',
          700: '#991b1b',
          800: '#7f1d1d',
          900: '#450a0a',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      // Mobile-first: ensure touch targets meet 44px minimum
      spacing: {
        'touch': '2.75rem', // 44px
      },
    },
  },
  plugins: [],
};

export default config;
