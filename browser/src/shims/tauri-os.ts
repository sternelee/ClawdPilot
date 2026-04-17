export function type(): string {
  return "browser";
}

export function platform(): string {
  return "browser";
}

export function arch(): string {
  return "unknown";
}

export function version(): string {
  return "0.0.0";
}

export function family(): string {
  return "browser";
}

export function locale(): string | null {
  if (typeof navigator !== "undefined") {
    return navigator.language;
  }
  return null;
}

export function hostname(): string {
  if (typeof window !== "undefined") {
    return window.location.hostname;
  }
  return "browser";
}
