import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#EEF1FD",
          100: "#DCE1FB",
          500: "#4338CA",
          600: "#3730A9",
          700: "#2E2789",
        },
        accent: {
          50: "#E6F4F0",
          100: "#CBE9E1",
          200: "#A4D5CA",
          300: "#71B9AB",
          400: "#2FA289",
          500: "#116E60",
          600: "#0F6B5C",
          700: "#0B5448",
          800: "#0A433B",
          900: "#083730",
        },
      },
    },
  },
  plugins: [],
};
export default config;
