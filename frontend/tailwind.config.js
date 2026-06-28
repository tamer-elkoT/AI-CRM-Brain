/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      // ─── Rabih CRM "Cognitive Enterprise" Design System ───
      // Primary action color: Deep Teal #0D9488
      // Primary container: Midnight Slate #0F172A
      "colors": {
        // ── Core Surfaces ──
        "surface":                    "#f8f9ff",
        "surface-bright":             "#f8f9ff",
        "surface-dim":                "#cbdbf5",
        "surface-container-lowest":   "#ffffff",
        "surface-container-low":      "#eff4ff",
        "surface-container":          "#e5eeff",
        "surface-container-high":     "#dce9ff",
        "surface-container-highest":  "#d3e4fe",
        "surface-variant":            "#d3e4fe",
        "surface-tint":               "#565e74",

        // ── On-Surface Text ──
        "on-surface":                 "#0b1c30",
        "on-surface-variant":         "#45464d",
        "inverse-surface":            "#213145",
        "inverse-on-surface":         "#eaf1ff",

        // ── Background ──
        "background":                 "#f8f9ff",
        "on-background":              "#0b1c30",

        // ── Primary: Deep Teal (action color) ──
        "primary":                    "#0D9488",
        "on-primary":                 "#ffffff",
        "primary-container":          "#0F172A",
        "on-primary-container":       "#cbd5e1",
        "primary-fixed":              "#dae2fd",
        "primary-fixed-dim":          "#bec6e0",
        "on-primary-fixed":           "#131b2e",
        "on-primary-fixed-variant":   "#3f465c",
        "inverse-primary":            "#bec6e0",

        // ── Secondary: Teal (mirrors primary in most designs) ──
        "secondary":                  "#0D9488",
        "on-secondary":               "#ffffff",
        "secondary-container":        "#86f2e4",
        "on-secondary-container":     "#006f66",
        "secondary-fixed":            "#89f5e7",
        "secondary-fixed-dim":        "#6bd8cb",
        "on-secondary-fixed":         "#00201d",
        "on-secondary-fixed-variant": "#005049",

        // ── Tertiary ──
        "tertiary":                   "#000000",
        "on-tertiary":                "#ffffff",
        "tertiary-container":         "#271901",
        "on-tertiary-container":      "#98805d",
        "tertiary-fixed":             "#fcdeb5",
        "tertiary-fixed-dim":         "#dec29a",
        "on-tertiary-fixed":          "#271901",
        "on-tertiary-fixed-variant":  "#574425",

        // ── Error ──
        "error":                      "#ba1a1a",
        "on-error":                   "#ffffff",
        "error-container":            "#ffdad6",
        "on-error-container":         "#93000a",

        // ── Outline ──
        "outline":                    "#76777d",
        "outline-variant":            "#c6c6cd",
      },

      "borderRadius": {
        "DEFAULT": "0.25rem",    // 4px — small buttons, tags
        "sm":      "0.125rem",   // 2px
        "md":      "0.375rem",   // 6px — inputs
        "lg":      "0.5rem",     // 8px — cards, containers
        "xl":      "0.75rem",    // 12px — interactive elements
        "2xl":     "1rem",       // 16px — modals, large cards
        "full":    "9999px",     // pill
      },

      "spacing": {
        "unit":            "4px",
        "max-width":       "1440px",
        "gutter":          "16px",
        "margin-desktop":  "32px",
        "margin-mobile":   "16px",
      },

      "fontFamily": {
        "headline-lg":        ["Geist", "sans-serif"],
        "headline-md":        ["Geist", "sans-serif"],
        "headline-lg-mobile": ["Geist", "sans-serif"],
        "display-lg":         ["Geist", "sans-serif"],
        "label-md":           ["Geist", "sans-serif"],
        "label-sm":           ["Geist", "sans-serif"],
        "body-lg":            ["Inter", "sans-serif"],
        "body-md":            ["Inter", "sans-serif"],
        "body-sm":            ["Inter", "sans-serif"],
        "mono-data":          ["JetBrains Mono", "monospace"],
      },

      "fontSize": {
        "display-lg":         ["48px",  { "lineHeight": "1.2",  "letterSpacing": "-0.02em", "fontWeight": "700" }],
        "headline-lg":        ["32px",  { "lineHeight": "1.3",  "fontWeight": "600" }],
        "headline-lg-mobile": ["24px",  { "lineHeight": "1.3",  "fontWeight": "600" }],
        "headline-md":        ["24px",  { "lineHeight": "1.4",  "fontWeight": "600" }],
        "body-lg":            ["18px",  { "lineHeight": "1.6",  "fontWeight": "400" }],
        "body-md":            ["16px",  { "lineHeight": "1.5",  "fontWeight": "400" }],
        "body-sm":            ["14px",  { "lineHeight": "1.5",  "fontWeight": "400" }],
        "label-md":           ["14px",  { "lineHeight": "1",    "letterSpacing": "0.02em", "fontWeight": "600" }],
        "label-sm":           ["12px",  { "lineHeight": "1",    "fontWeight": "500" }],
        "mono-data":          ["13px",  { "lineHeight": "1",    "fontWeight": "400" }],
      }
    }
  },
  plugins: [],
}
