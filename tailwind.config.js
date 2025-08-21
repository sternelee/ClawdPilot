/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Source Code Pro', 'Menlo', 'Consolas', 'DejaVu Sans Mono', 'monospace'],
      },
    },
  },
  plugins: [
    require("daisyui")
  ],
  daisyui: {
    themes: [
      "light",
      "dark", 
      "corporate",
      "business",
      "night",
      "forest",
      "dracula",
      "luxury",
      "synthwave",
      {
        "riterm-dark": {
          "primary": "#4F46E5",
          "primary-content": "#ffffff",
          "secondary": "#10B981",
          "secondary-content": "#ffffff",
          "accent": "#F59E0B",
          "accent-content": "#ffffff",
          "neutral": "#374151",
          "neutral-content": "#D1D5DB",
          "base-100": "#111827",
          "base-200": "#1F2937",
          "base-300": "#374151",
          "base-content": "#F9FAFB",
          "info": "#3B82F6",
          "success": "#10B981",
          "warning": "#F59E0B",
          "error": "#EF4444",
        },
        "riterm-light": {
          "primary": "#4F46E5",
          "primary-content": "#ffffff",
          "secondary": "#059669",
          "secondary-content": "#ffffff",
          "accent": "#D97706",
          "accent-content": "#ffffff",
          "neutral": "#6B7280",
          "neutral-content": "#F9FAFB",
          "base-100": "#ffffff",
          "base-200": "#F9FAFB",
          "base-300": "#F3F4F6",
          "base-content": "#1F2937",
          "info": "#3B82F6",
          "success": "#10B981",
          "warning": "#F59E0B",
          "error": "#EF4444",
        }
      }
    ],
  },
}
