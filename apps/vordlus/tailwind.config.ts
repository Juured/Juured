import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Per UI brief: warm light grey-beige bg, dark slate primary
        paper: "#F7F7F7",
        ink: "#1A1A1A",
        body: "#1A1A1A",
        muted: "#6B6F6A",
        faint: "#9AA09A",
        rule: "#E5E4DD",
        rule2: "#D4D2C8",
        field: "#FFFFFF",
        // Price accent: red above market, green below
        up: "#9A1B1B",
        down: "#166534",
        // Energy A/B/C tags
        energyA: "#166534",
        energyB: "#65A30D",
        energyC: "#CA8A04",
        // Positive/warn (for readiness)
        good: "#166534",
        warn: "#B45309",
        bad: "#9A1B1B",
        // Star
        star: "#1A1A1A",
        starOff: "#D4D2C8",
      },
      fontFamily: {
        // Same family as juured.com for brand consistency
        display: ['"Fraunces"', "ui-serif", "Georgia", "Cambria", "serif"],
        sans: ['"Inter Tight"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
        tighter: "-0.025em",
        tight: "-0.015em",
        eyebrow: "0.14em",
      },
      maxWidth: {
        sheet: "46rem",
        compare: "90rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
