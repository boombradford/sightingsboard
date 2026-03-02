/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        night: {
          950: "#060d15",
          900: "#0a1824",
          850: "#102432",
        },
      },
      boxShadow: {
        panel: "0 22px 48px rgba(2, 10, 16, 0.42)",
      },
      fontFamily: {
        display: ["Bebas Neue", "sans-serif"],
        body: ["Manrope", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
