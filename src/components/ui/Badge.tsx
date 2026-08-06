import { type Component, splitProps } from "solid-js";
import { cn } from "~/lib/utils";

interface BadgeProps {
	variant?: "default" | "success" | "warning" | "error" | "info";
	class?: string;
	children?: any;
}

export const Badge: Component<BadgeProps> = (rawProps) => {
	const [props] = splitProps(rawProps, ["class", "variant", "children"]);

	const variantClass = () => {
		switch (props.variant || "default") {
			case "success":
				return "bg-success/15 text-success";
			case "warning":
				return "bg-warning/15 text-warning";
			case "error":
				return "bg-error/15 text-error";
			case "info":
				return "bg-info/15 text-info";
			default:
				return "bg-[hsl(var(--b2))] text-[hsl(var(--bc)/0.6)]";
		}
	};

	return (
		<span
			class={cn(
				"inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--as-radius,0.25rem)]",
				"text-[var(--as-font-size-sm,0.8125rem)] font-medium",
				variantClass(),
				props.class,
			)}
		>
			{props.children}
		</span>
	);
};
