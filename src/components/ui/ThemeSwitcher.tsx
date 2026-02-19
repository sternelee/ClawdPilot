import { createSignal, createEffect, onMount, For } from "solid-js";

interface ThemeSwitcherProps {
  class?: string;
}

// DaisyUI sunset theme-based themes
const themes = [
  { id: "sunset", name: "Sunset", color: "#fb923c" },
  { id: "dark", name: "Dark", color: "#1d283a" },
  { id: "sunset", name: "Light", color: "#ffffff" },
  { id: "dracula", name: "Dracula", color: "#7b2cbf" },
  { id: "night", name: "Night", color: "#0f1729" },
  { id: "business", name: "Business", color: "#1e293b" },
  { id: "synthwave", name: "Synthwave", color: "#d946ef" },
  { id: "forest", name: "Forest", color: "#22c55e" },
  { id: "luxury", name: "Luxury", color: "#78716c" },
  { id: "corporate", name: "Corporate", color: "#3b82f6" },
];

export function ThemeSwitcher(props: ThemeSwitcherProps) {
  const [currentTheme, setCurrentTheme] = createSignal("sunset");

  // Load theme from localStorage on mount
  onMount(() => {
    const savedTheme = localStorage.getItem("theme") || "sunset";
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

  return (
    <details class={`relative dropdown ${props.class || ""}`}>
      <summary title="切换主题" class="btn btn-ghost btn-circle">
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
      </summary>
      <ul class="dropdown-content z-[1] menu p-2 shadow bg-base-200 rounded-box w-52 mt-2">
        <li class="menu-title px-2 py-1">
          <span class="text-xs font-semibold uppercase tracking-wide">选择主题</span>
        </li>
        {/* DaisyUI theme options */}
        <For each={themes}>
          {(theme) => (
            <li>
              <button
                type="button"
                class={currentTheme() === theme.id ? "active" : ""}
                onClick={() => handleThemeChange(theme.id)}
              >
                <div
                  class="w-4 h-4 rounded-full"
                  style={`background-color: ${theme.color}`}
                ></div>
                {theme.name}
              </button>
            </li>
          )}
        </For>
      </ul>
    </details>
  );
}
