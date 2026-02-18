import { Show, splitProps } from "solid-js";
import type { JSX, ParentComponent } from "solid-js";
import { cn } from "~/lib/utils";

type ButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link"
  // Legacy variants for backward compatibility
  | "primary"
  | "success"
  | "warning";
type ButtonSize =
  | "default"
  | "sm"
  | "lg"
  | "icon"
  | "icon-sm"
  | "icon-lg"
  // Legacy sizes for backward compatibility
  | "xs"
  | "md";

const buttonVariantClasses: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
  primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
  destructive:
    "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
  outline:
    "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost:
    "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
  link: "text-primary underline-offset-4 hover:underline",
  success: "bg-emerald-500 text-white hover:bg-emerald-600",
  warning: "bg-amber-500 text-white hover:bg-amber-600",
};

const buttonSizeClasses: Record<ButtonSize, string> = {
  default: "h-9 px-4 py-2 has-[>svg]:px-3",
  sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
  lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
  icon: "size-9",
  "icon-sm": "size-8",
  "icon-lg": "size-10",
  xs: "h-7 px-2 text-xs",
  md: "h-10 px-4 text-sm",
};

export type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  asChild?: boolean;
};

export function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, [
    "class",
    "variant",
    "size",
    "loading",
    "disabled",
    "children",
    "asChild",
  ]);

  return (
    <button
      {...rest}
      disabled={local.disabled || local.loading}
      class={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all",
        "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
        "outline-none",
        buttonVariantClasses[local.variant ?? "default"],
        buttonSizeClasses[local.size ?? "default"],
        local.class,
      )}
    >
      <Show when={local.loading}>
        <Spinner size="sm" />
      </Show>
      {local.children}
    </button>
  );
}

export const Card: ParentComponent<{ class?: string; onClick?: () => void }> = (props) => (
  <section
    class={cn(
      "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
      props.onClick ? "cursor-pointer transition-all duration-200 hover:shadow-md hover:border-ring/30" : "",
      props.class,
    )}
    onClick={props.onClick}
  >
    {props.children}
  </section>
);

export const CardBody: ParentComponent<{ class?: string }> = (props) => (
  <div class={cn("px-6", props.class)}>{props.children}</div>
);

export const CardHeader: ParentComponent<{ class?: string }> = (props) => (
  <div class={cn("px-6 pb-4", props.class)}>{props.children}</div>
);

export const CardFooter: ParentComponent<{ class?: string }> = (props) => (
  <div class={cn("flex items-center px-6 pt-4", props.class)}>{props.children}</div>
);

export const CardTitle: ParentComponent<{ class?: string }> = (props) => (
  <h2 class={cn("leading-none font-semibold text-lg", props.class)}>
    {props.children}
  </h2>
);

export const CardDescription: ParentComponent<{ class?: string }> = (props) => (
  <p class={cn("text-muted-foreground text-sm", props.class)}>
    {props.children}
  </p>
);

export const CardActions: ParentComponent<{ class?: string }> = (props) => (
  <div class={cn("flex flex-wrap items-center gap-2 mt-auto pt-4", props.class)}>
    {props.children}
  </div>
);

type InputBaseProps = {
  class?: string;
  variant?: "default" | "ghost";
};

export type InputProps = JSX.InputHTMLAttributes<HTMLInputElement> & InputBaseProps;

const inputVariants = {
  default: [
    "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground",
    "border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none",
    "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
    "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  ],
  ghost: "bg-transparent outline-none text-sm",
};

export function Input(props: InputProps) {
  const [local, rest] = splitProps(props, ["class", "variant"]);
  return (
    <input
      {...rest}
      class={cn(
        ...inputVariants[local.variant ?? "default"],
        local.class,
      )}
    />
  );
}

export type TextareaProps = JSX.TextareaHTMLAttributes<HTMLTextAreaElement> &
  InputBaseProps;

export function Textarea(props: TextareaProps) {
  const [local, rest] = splitProps(props, ["class", "variant"]);
  return (
    <textarea
      {...rest}
      class={cn(
        "min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground",
        "placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "transition-[color,box-shadow] outline-none",
        local.class,
      )}
    />
  );
}

export type SelectProps = JSX.SelectHTMLAttributes<HTMLSelectElement> & {
  class?: string;
};

export function Select(props: SelectProps) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <select
      {...rest}
      class={cn(
        "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "outline-none transition-[color,box-shadow]",
        local.class,
      )}
    >
      {local.children}
    </select>
  );
}

export type SwitchProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  class?: string;
  label?: JSX.Element;
};

export function Switch(props: SwitchProps) {
  const [local, rest] = splitProps(props, ["class", "label"]);
  return (
    <label class={cn("inline-flex items-center gap-3", local.class)}>
      <Show when={local.label}>
        <span class="text-sm text-foreground">{local.label}</span>
      </Show>
      <input
        {...rest}
        type="checkbox"
        class="peer sr-only"
      />
      <span
        class={cn(
          "relative h-6 w-11 rounded-full border border-input bg-muted transition-colors",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
          "peer-checked:border-primary peer-checked:bg-primary",
          "after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-background after:transition-transform",
          "peer-checked:after:translate-x-5",
        )}
      />
    </label>
  );
}

type BadgeVariant =
  | "default"
  | "primary"
  | "secondary"
  | "outline"
  | "success"
  | "destructive"
  // Legacy variants for backward compatibility
  | "neutral"
  | "info";

const badgeVariantClasses: Record<BadgeVariant, string> = {
  default: "border-transparent bg-muted text-muted-foreground",
  primary: "border-transparent bg-primary text-primary-foreground",
  secondary: "border-transparent bg-secondary text-secondary-foreground",
  outline: "border-border text-foreground",
  success: "border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  destructive: "border-transparent bg-destructive/15 text-destructive dark:bg-destructive/20",
  neutral: "border-transparent bg-foreground text-background",
  info: "border-transparent bg-blue-500/15 text-blue-600 dark:text-blue-400",
};

export type BadgeProps = JSX.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge(props: BadgeProps) {
  const [local, rest] = splitProps(props, ["class", "variant", "children"]);
  return (
    <span
      {...rest}
      class={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        badgeVariantClasses[local.variant ?? "default"],
        local.class,
      )}
    >
      {local.children}
    </span>
  );
}

type AlertVariant = "info" | "success" | "warning" | "error";
const alertVariantClasses: Record<AlertVariant, string> = {
  info: "border-info/40 bg-info/15 text-info",
  success: "border-success/40 bg-success/15 text-success",
  warning: "border-warning/40 bg-warning/15 text-warning",
  error: "border-error/40 bg-error/15 text-error",
};

export type AlertProps = JSX.HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
};

export function Alert(props: AlertProps) {
  const [local, rest] = splitProps(props, ["class", "variant", "children"]);
  return (
    <div
      {...rest}
      class={cn(
        "flex items-start gap-3 rounded-md border px-4 py-3",
        alertVariantClasses[local.variant ?? "info"],
        local.class,
      )}
    >
      {local.children}
    </div>
  );
}

export type DialogProps = {
  open: boolean;
  onClose?: () => void;
  class?: string;
  contentClass?: string;
  showCloseButton?: boolean;
  children: JSX.Element;
};

export function Dialog(props: DialogProps) {
  return (
    <Show when={props.open}>
      <div class={cn("fixed inset-0 z-50 flex items-center justify-center p-4", props.class)}>
        {/* Superset-style overlay with fade animation */}
        <button
          type="button"
          class="fixed inset-0 z-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          onClick={props.onClose}
          aria-label="Close dialog"
        />
        {/* Superset-style dialog with scale and fade animations */}
        <div
          class={cn(
            "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-10 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
            props.contentClass,
          )}
        >
          {props.children}
        </div>
      </div>
    </Show>
  );
}

export type DialogHeaderProps = JSX.HTMLAttributes<HTMLDivElement>;

export function DialogHeader(props: DialogHeaderProps) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <div class={cn("flex flex-col gap-1.5 text-center sm:text-left", local.class)} {...rest}>
      {local.children}
    </div>
  );
}

export type DialogFooterProps = JSX.HTMLAttributes<HTMLDivElement>;

export function DialogFooter(props: DialogFooterProps) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <div class={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", local.class)} {...rest}>
      {local.children}
    </div>
  );
}

export type DialogTitleProps = JSX.HTMLAttributes<HTMLHeadingElement>;

export function DialogTitle(props: DialogTitleProps) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <h2 class={cn("text-lg leading-none font-semibold", local.class)} {...rest}>
      {local.children}
    </h2>
  );
}

export type DialogDescriptionProps = JSX.HTMLAttributes<HTMLParagraphElement>;

export function DialogDescription(props: DialogDescriptionProps) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <p class={cn("text-muted-foreground text-sm", local.class)} {...rest}>
      {local.children}
    </p>
  );
}

export type DialogCloseProps = JSX.ButtonHTMLAttributes<HTMLButtonElement>;

export function DialogClose(props: DialogCloseProps) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <button
      type="button"
      class={cn(
        "ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        local.class,
      )}
      {...rest}
    >
      {local.children}
    </button>
  );
}

type SpinnerSize = "xs" | "sm" | "md" | "lg";
const spinnerSizeClasses: Record<SpinnerSize, string> = {
  xs: "h-3 w-3 border",
  sm: "h-4 w-4 border-2",
  md: "h-5 w-5 border-2",
  lg: "h-7 w-7 border-[3px]",
};

export function Spinner(props: { class?: string; size?: SpinnerSize }) {
  return (
    <span
      class={cn(
        "inline-block animate-spin rounded-full border-current border-t-transparent",
        spinnerSizeClasses[props.size ?? "md"],
        props.class,
      )}
    />
  );
}

export const Kbd: ParentComponent<{ class?: string }> = (props) => (
  <kbd
    class={cn(
      "inline-flex min-h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 text-[10px] font-semibold",
      props.class,
    )}
  >
    {props.children}
  </kbd>
);

export const Label: ParentComponent<{ class?: string; for?: string }> = (
  props,
) => (
  <label for={props.for} class={cn("text-sm font-medium text-foreground", props.class)}>
    {props.children}
  </label>
);
