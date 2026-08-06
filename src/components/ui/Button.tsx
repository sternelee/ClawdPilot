import { type Component, type JSX, splitProps } from "solid-js";
import { cn } from "~/lib/utils";

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export const Button: Component<ButtonProps> = (rawProps) => {
  const [props, rest] = splitProps(rawProps, [
    "class",
    "variant",
    "size",
    "children",
  ]);

  const variantClass = () => {
    switch (props.variant || "secondary") {
      case "primary":
        return "bg-[hsl(var(--p))] text-[hsl(var(--pc))] hover:opacity-90";
      case "danger":
        return "bg-[hsl(var(--er))] text-[hsl(var(--erc))] hover:opacity-90";
      case "ghost":
        return "hover:bg-[hsl(var(--b2)/0.5)]";
      default:
        return "bg-[hsl(var(--b2))] hover:bg-[hsl(var(--b3))]";
    }
  };

  const sizeClass = () => {
    switch (props.size || "md") {
      case "sm": return "text-[var(--as-font-size-sm,0.8125rem)] px-2 py-1";
      case "lg": return "text-base px-5 py-2.5";
      default:   return "text-[var(--as-font-size-base,0.875rem)] px-3 py-1.5";
    }
  };

  return (
    <button
      {...rest}
      class={cn(
        "inline-flex items-center gap-1.5 font-medium transition-all",
        "rounded-[var(--as-radius,0.25rem)]",
        "duration-[var(--as-transition-speed,0.15s)]",
        "focus-visible:outline-2 focus-visible:outline-[hsl(var(--p))] focus-visible:outline-offset-2",
        "disabled:opacity-40 disabled:pointer-events-none",
        variantClass(),
        sizeClass(),
        props.class,
      )}
    >
      {props.children}
    </button>
  );
};
