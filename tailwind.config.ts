import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Теперь font-sans — это Montserrat. Он сильно отличается от стандарта.
        sans: ['var(--font-montserrat)', 'sans-serif'],
        // font-serif — это Lora.
        serif: ['var(--font-lora)', 'serif'],
      },
      colors: {
        blue: {
          900: '#0f172a',
        }
      }
    },
  },
  plugins: [],
};
export default config;