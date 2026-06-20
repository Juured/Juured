import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Surfaces ──────────────────────────────────────────────────
        // Warm cream / off-white. Never pure white. Editorial, premium.
        paper: "#FDFBF7",         // page background (was #F7F7F7)
        paperDeep: "#F7F4EF",     // card / panel — subtle lift
        field: "#FBF8F2",         // inputs — slightly recessed

        // ── Text ─────────────────────────────────────────────────────
        // Deep charcoal, not pure black.
        ink: "#1E1E1E",           // body text (was #1A1A1A)
        body: "#1E1E1E",          // alias for legacy code
        inkDeep: "#111111",       // headings + structural blocks

        // ── Muted text / borders ─────────────────────────────────────
        // Warm taupe, not cool grey.
        muted: "#7A7268",         // secondary text (was #6B6F6A)
        faint: "#A8A094",         // tertiary text (was #9AA09A)
        rule: "#E6E1DA",          // dividers / borders (was #E5E4DD)
        rule2: "#C8C2BA",         // heavier borders (was #D4D2C8)

        // ── Brand accent ─────────────────────────────────────────────
        // Muted earthy brown / ochre. Property & land. Use for active
        // nav, brand highlights, primary CTA hover, brand badge.
        accent: "#8C6D4F",
        accentSoft: "#A88A6B",    // hover
        accentInk: "#5C4530",     // text on accent bg
        accentTint: "#F4ECDF",    // very subtle background wash

        // ── Data viz ─────────────────────────────────────────────────
        // Soft sand & warm gradients. Quiets the analytics panels.
        sand: "#E8DCC8",
        sandDeep: "#C9B79A",
        sandInk: "#7A6347",

        // ── Price / status ───────────────────────────────────────────
        // Warm — not the standard "alert" red/green. Slightly desaturated.
        up: "#8B2929",            // price above market (was #9A1B1B)
        down: "#3F6B3F",          // price below market (was #166534)

        // ── Energy grades A/B/C ──────────────────────────────────────
        energyA: "#3F6B3F",
        energyB: "#7A8A3F",
        energyC: "#A88A4F",

        // ── Good / warn / bad ────────────────────────────────────────
        good: "#3F6B3F",
        warn: "#A87A3F",          // was #B45309
        bad: "#8B2929",

        // ── Star ─────────────────────────────────────────────────────
        star: "#1E1E1E",
        starOff: "#C8C2BA",
      },
      fontFamily: {
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
