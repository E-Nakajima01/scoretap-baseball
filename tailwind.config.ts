import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        field: {
          grass: "#2F7D47",
          clay: "#B96F3C",
          chalk: "#F6F1E8",
        },
      },
      boxShadow: {
        panel: "0 18px 50px rgba(15, 23, 42, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
