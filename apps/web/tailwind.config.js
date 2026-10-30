/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        slate: {
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1", // light silver
          400: "#B3B7CE", // mobile textSecondary (bright, clearly visible light text)
          500: "#9BA1C2", // mobile lavender (clearly visible text/caption tone)
          600: "#475069", // dark slate for light mode text
          700: "#1E2238", // mobile surfaceSoft
          800: "#141727", // mobile surface / card
          850: "#0D101B", // mobile bgRaised
          900: "#0A0C15", // mobile sidebar / dark header
          950: "#07080E", // mobile obsidian bg
        },
        blue: {
          50: "#EEF0FF",
          100: "#E0E3FF",
          200: "#C7CDFF",
          300: "#A8B2FF",
          400: "#8C95FF", // mobile indigoSoft
          500: "#6B77F5",
          600: "#5965F2", // mobile primary indigo
          700: "#4A55DB", // mobile primary hover
          800: "#3E48C9", // mobile primary active
          900: "#1D2158", // mobile indigoDeep
          950: "#121438",
        },
        indigo: {
          50: "#EEF0FF",
          100: "#E0E3FF",
          200: "#C7CDFF",
          300: "#A8B2FF",
          400: "#8C95FF", // mobile indigoSoft
          500: "#6B77F5",
          600: "#5965F2", // mobile indigo
          700: "#4A55DB",
          800: "#3E48C9",
          900: "#1D2158",
          950: "#121438",
        },
        cyan: {
          50: "#F0F9FF",
          100: "#E0F2FE",
          200: "#BAE6FD",
          300: "#7DD3FC",
          400: "#76B8FF", // mobile info / wfh cyan
          500: "#38BDF8",
          600: "#0284C7",
          700: "#0369A1",
          800: "#075985",
          900: "#0C4A6E",
        },
        emerald: {
          50: "#ECFDF5",
          100: "#D1FAE5",
          200: "#A7F3D0",
          300: "#6EE7B7",
          400: "#45D6A6", // mobile present / success mint
          500: "#10B981",
          600: "#059669",
          700: "#047857",
          800: "#065F46",
          900: "#064E3B",
          950: "#022C22",
        },
        amber: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          200: "#FDE68A",
          300: "#FCD34D",
          400: "#F5C76B", // mobile late / warning gold
          500: "#F59E0B",
          600: "#D97706",
          700: "#B45309",
          800: "#92400E",
          900: "#78350F",
          950: "#451A03",
        },
        rose: {
          50: "#FFF1F2",
          100: "#FFE4E6",
          200: "#FECDD3",
          300: "#FDA4AF",
          400: "#FF6B83", // mobile absent / danger coral
          500: "#F43F5E",
          600: "#E11D48",
          700: "#BE123C",
          800: "#9F1239",
          900: "#881337",
          950: "#4C0519",
        },
        purple: {
          50: "#FAF5FF",
          100: "#F3E8FF",
          200: "#E9D5FF",
          300: "#D8B4FE",
          400: "#C4A7FF", // mobile leave lavender
          500: "#A855F7",
          600: "#9333EA",
          700: "#7E22CE",
          800: "#6B21A8",
          900: "#581C87",
        },
        brand: {
          950: "#07080E", // Mobile obsidian bg
          900: "#0A0C15", // Mobile sidebar
          850: "#0D101B", // Mobile bgRaised
          800: "#141727", // Mobile surface
          700: "#1E2238", // Mobile surfaceSoft
          600: "#2B304C",
          500: "#5965F2", // Mobile indigo
          400: "#8C95FF", // Mobile indigoSoft
          300: "#B3B7CE",
          200: "#E2E8F0",
          100: "#F1F5F9",
          50: "#F8FAFC",
        },
        accent: {
          blue: "#5965F2", // Primary electric indigo (mobile brand)
          blueHover: "#4A55DB",
          cyan: "#76B8FF", // Secondary vibrant cyan
          indigo: "#5965F2",
          indigoSoft: "#8C95FF",
          indigoDeep: "#1D2158",
          lavender: "#9194BA",
        },
        status: {
          present: "#45D6A6", // Mobile mint
          late: "#F5C76B",    // Mobile gold
          absent: "#FF6B83",  // Mobile coral
          wfh: "#76B8FF",     // Mobile cyan
          leave: "#C4A7FF",   // Mobile lavender
          holiday: "#C4A7FF",
          incomplete: "#F5C76B",
          pending: "#F5C76B",
          approved: "#45D6A6",
          rejected: "#FF6B83",
        },
      },
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Oxygen",
          "Ubuntu",
          "sans-serif",
        ],
        mono: [
          '"Space Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)",
        subtle: "0 4px 6px -1px rgba(15, 23, 42, 0.05), 0 2px 4px -2px rgba(15, 23, 42, 0.05)",
        glow: "0 0 24px -4px rgba(89, 101, 242, 0.35)",
        glowCyan: "0 0 24px -4px rgba(118, 184, 255, 0.35)",
      },
    },
  },
  plugins: [],
};
