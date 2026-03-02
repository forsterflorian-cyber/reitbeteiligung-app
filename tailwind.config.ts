import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        sand: "#f7f3ea",
        forest: "#234038",
        clay: "#b76e4c",
        ink: "#1f2937"
      },
      boxShadow: {
        soft: "0 18px 45px rgba(35, 64, 56, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
