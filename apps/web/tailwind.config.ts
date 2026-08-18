import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        tumbu: {
          navy: '#0F1E3A',
          green: '#0F9365',
          light: '#F9FBF7',
        }
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        marquee: 'marquee 30s linear infinite',
        float: 'float 6s ease-in-out infinite',
        float2: 'float2 7s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
        aurora: 'aurora 20s linear infinite',
        gridMove: 'gridMove 20s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) rotateX(10deg) rotateY(-10deg)' },
          '50%': { transform: 'translateY(-14px) rotateX(12deg) rotateY(-12deg)' },
        },
        float2: {
          '0%, 100%': { transform: 'translateY(0) rotateX(-6deg) rotateY(12deg)' },
          '50%': { transform: 'translateY(-10px) rotateX(-8deg) rotateY(14deg)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        aurora: {
          '0%': { transform: 'translate(-10%, -10%) rotate(0deg)' },
          '50%': { transform: 'translate(10%, 15%) rotate(180deg)' },
          '100%': { transform: 'translate(-10%, -10%) rotate(360deg)' },
        },
        gridMove: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(40px)' },
        }
      }
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};
export default config;
