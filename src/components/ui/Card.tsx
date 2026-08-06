import { type Component, type JSX, splitProps } from "solid-js";
import { cn } from "~/lib/utils";

interface CardProps extends JSX.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  bordered?: boolean;
}

export const Card: Component<CardProps> = (rawProps) => {
  const [props, rest] = splitProps(rawProps, ["class", "padded", "bordered", "children"]);
  const isBordered = () => props.bordered ?? true;

  return (
    <div
      {...rest}
      class={cn(
        "rounded-[var(--as-radius-lg,0.5rem)]",
        isBordered() && "border border-[hsl(var(--bc)/0.1)]",
        "bg-[var(--as-card-bg,transparent)]",
        props.padded && "p-[var(--as-section-gap,1rem)]",
        props.class,
      )}
    >
      {props.children}
    </div>
  );
};
