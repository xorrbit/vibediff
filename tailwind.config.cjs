/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Obsidian Studio - refined dark theme
        obsidian: {
          // Base tones - deep blacks with subtle warmth
          void: '#0a0a0b',
          bg: '#111113',
          surface: '#18181b',
          elevated: '#1f1f23',
          float: '#27272c',

          // Border system - subtle layering
          border: '#2d2d33',
          'border-subtle': '#232328',
          'border-focus': '#3d3d45',

          // Text hierarchy
          text: '#e4e4e7',
          'text-secondary': '#a1a1aa',
          'text-muted': '#71717a',
          'text-ghost': '#52525b',

          // Accent - warm amber/gold
          accent: '#f59e0b',
          'accent-dim': '#d97706',
          'accent-glow': 'rgba(245, 158, 11, 0.15)',
          'accent-subtle': 'rgba(245, 158, 11, 0.08)',

          // Status colors - refined and legible
          added: '#34d399',
          'added-bg': 'rgba(52, 211, 153, 0.1)',
          modified: '#fbbf24',
          'modified-bg': 'rgba(251, 191, 36, 0.1)',
          deleted: '#f87171',
          'deleted-bg': 'rgba(248, 113, 113, 0.1)',

          // Special
          selection: 'rgba(245, 158, 11, 0.2)',
        },
      },
      fontFamily: {
        sans: [
          'SF Pro Display',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'SF Mono',
          'Fira Code',
          'Consolas',
          'monospace',
        ],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        'glow': '0 0 20px -5px rgba(245, 158, 11, 0.3)',
        'glow-sm': '0 0 10px -3px rgba(245, 158, 11, 0.2)',
        'elevated': '0 4px 20px -2px rgba(0, 0, 0, 0.5)',
        'float': '0 8px 30px -4px rgba(0, 0, 0, 0.6)',
        'inset-border': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.03)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.19, 1, 0.22, 1)',
      },
    },
  },
  plugins: [],
}
