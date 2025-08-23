import { createSignal, createEffect, onMount, For } from "solid-js";

interface ThemeSwitcherProps {
  class?: string;
}

// DaisyUI themes list - you can customize this list
const themes = [
  "light",
  "dark",
  "cupcake",
  "bumblebee",
  "emerald",
  "corporate",
  "synthwave",
  "retro",
  "cyberpunk",
  "valentine",
  "halloween",
  "garden",
  "forest",
  "aqua",
  "lofi",
  "pastel",
  "fantasy",
  "wireframe",
  "black",
  "luxury",
  "dracula",
  "cmyk",
  "autumn",
  "business",
  "acid",
  "lemonade",
  "night",
  "coffee",
  "winter",
  "dim",
  "nord",
  "sunset",
];

export function ThemeSwitcher(props: ThemeSwitcherProps) {
  const [currentTheme, setCurrentTheme] = createSignal("riterm-mobile");
  const [isOpen, setIsOpen] = createSignal(true);

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
    setIsOpen(false);
  };

  const getThemeDisplayName = (theme: string) => {
    return theme === "riterm-mobile"
      ? "RiTerm"
      : theme.charAt(0).toUpperCase() + theme.slice(1);
  };

  console.log(currentTheme(), isOpen());

  return (
    <details class={`dropdown dropdown-end ${props.class || ""}`}>
      <summary class="btn btn-ghost btn-circle" title="切换主题">
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
      <ul class="dropdown-content menu flex flex-col flex-nowrap bg-base-200 rounded-box z-[1] w-fit p-2 shadow-2xl max-h-80 overflow-y-auto">
        <li class="menu-title">
          <span>选择主题</span>
        </li>
        {/* Current RiTerm theme */}
        <li>
          <a
            class={`btn ${currentTheme() === "riterm-mobile" ? "active" : ""}`}
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
          </a>
        </li>
        {/* DaisyUI themes */}
        <For each={themes}>
          {(theme) => (
            <li>
              <a
                class={`btn ${currentTheme() === theme ? "active" : ""}`}
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
              </a>
            </li>
          )}
        </For>
      </ul>
    </details>
  );
}
