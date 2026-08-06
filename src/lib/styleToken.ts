/**
 * 读取当前 data-style 作用域下的 CSS 变量值。
 * 若变量未定义，回退到 claude 默认值（定义在 agent-styles.css 中）。
 */
export function readStyleVar(name: string): string {
  if (typeof document === "undefined") return "";
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--as-${name}`)
    .trim();
  return value || "";
}

/**
 * 批量读取多个风格变量，返回 record。
 */
export function readStyleVars(names: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of names) {
    result[name] = readStyleVar(name);
  }
  return result;
}

/**
 * 返回当前 data-style 属性值。
 */
export function getCurrentStyle(): string {
  if (typeof document === "undefined") return "claude";
  return (
    document.documentElement.getAttribute("data-style") || "claude"
  );
}
