/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          950: "#0B132B", // Deepest navy
          900: "#111C38", // Dark navy surface
          800: "#1C2541", // Midnight slate
          700: "#253252",
          600: "#3A506B", // Slate accent
        },
        accent: {
          blue: "#2563EB", // Primary electric blue
          cyan: "#06B6D4", // Secondary vibrant cyan
          indigo: "#6366F1", // Tertiary indigo accent
        },
        status: {
          present: "#10B981", // Emerald
          late: "#F59E0B", // Amber
          absent: "#EF4444", // Rose
          wfh: "#6366F1", // Indigo
          leave: "#06B6D4", // Cyan
          holiday: "#8B5CF6", // Purple
          incomplete: "#F97316", // Orange
          pending: "#F59E0B", // Amber
          approved: "#10B981", // Emerald
          rejected: "#EF4444", // Rose
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Oxygen",
          "Ubuntu",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)",
        subtle: "0 4px 6px -1px rgba(15, 23, 42, 0.05), 0 2px 4px -2px rgba(15, 23, 42, 0.05)",
      },
    },
  },
  plugins: [],
};

