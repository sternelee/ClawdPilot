import { createSignal, createEffect, onMount, For } from "solid-js";
import { Button } from "./primitives";

interface ThemeSwitcherProps {
  class?: string;
}

// Supported themes in the local token system
const themes = [
  "corporate",
  "business",
  "dark",
  "dracula",
  "forest",
  "light",
  "luxury",
  "night",
  "synthwave",
];

export function ThemeSwitcher(props: ThemeSwitcherProps) {
  const [currentTheme, setCurrentTheme] = createSignal("riterm-mobile");

  // Load theme from localStorage on mount
  onMount(() => {
    const savedTheme = localStorage.getItem("theme") || "riterm-mobile";
    setCurrentTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
  });

  // Save theme to localStorage and update DOM when theme changes
  createEffect(() => {
    const theme = currentTheme();
    localStorage.setItem("theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  });

  const handleThemeChange = (theme: string) => {
    setCurrentTheme(theme);
  };

  const getThemeDisplayName = (theme: string) => {
    return theme === "riterm-mobile"
      ? "RiTerm"
      : theme.charAt(0).toUpperCase() + theme.slice(1);
  };

  return (
    <details class={`relative ${props.class || ""}`}>
      <summary title="切换主题">
        <Button variant="ghost" size="icon">
        <svg
          width="20"
          height="20"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          class="inline-block h-5 w-5 stroke-current"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v6a2 2 0 002 2h4a2 2 0 002-2V5z"
          ></path>
        </svg>
        </Button>
      </summary>
      <ul class="absolute right-0 z-[80] mt-2 flex max-h-80 w-52 flex-col overflow-y-auto rounded-lg border border-border bg-card p-2 shadow-2xl">
        <li class="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          选择主题
        </li>
        {/* Current RiTerm theme */}
        <li>
          <button
            type="button"
            class={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground ${currentTheme() === "riterm-mobile" ? "bg-primary text-primary-foreground" : ""}`}
            onClick={() => handleThemeChange("riterm-mobile")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              class="w-4 h-4"
            >
              <path d="M13 3L4 14h7v7l9-11h-7V3z" />
            </svg>
            RiTerm
          </button>
        </li>
        {/* Additional themes */}
        <For each={themes}>
          {(theme) => (
            <li>
              <button
                type="button"
                class={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground ${currentTheme() === theme ? "bg-primary text-primary-foreground" : ""}`}
                onClick={() => handleThemeChange(theme)}
              >
                <div class="flex items-center gap-2">
                  <div
                    class="w-3 h-3 rounded-full"
                    style={`background-color: hsl(var(--p))`}
                    data-theme={theme}
                  ></div>
                  {getThemeDisplayName(theme)}
                </div>
              </button>
            </li>
          )}
        </For>
      </ul>
    </details>
  );
}
