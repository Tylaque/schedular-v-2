import type { Config } from "tailwindcss";

const config: Config = {
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
      },
    },
  },
  plugins: [],
};
export default config;
