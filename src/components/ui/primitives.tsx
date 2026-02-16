import { Show, splitProps } from "solid-js";
import type { JSX, ParentComponent } from "solid-js";
import { cn } from "~/lib/utils";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "outline"
  | "destructive"
  | "success"
  | "warning";
type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon";

const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:brightness-105",
  secondary: "bg-secondary text-secondary-foreground hover:brightness-105",
  ghost: "bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground",
  outline:
    "border border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground",
  destructive: "bg-destructive text-destructive-foreground hover:brightness-105",
  success: "bg-success text-success-foreground hover:brightness-105",
  warning: "bg-warning text-warning-foreground hover:brightness-105",
};

const buttonSizeClasses: Record<ButtonSize, string> = {
  xs: "h-7 px-2 text-xs",
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
  icon: "h-10 w-10 p-0",
};

export type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, [
    "class",
    "variant",
    "size",
    "loading",
    "disabled",
    "children",
  ]);

  return (
    <button
      {...rest}
      disabled={local.disabled || local.loading}
      class={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-55",
        buttonVariantClasses[local.variant ?? "primary"],
        buttonSizeClasses[local.size ?? "md"],
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
      "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
      props.onClick ? "cursor-pointer transition-all duration-200 hover:shadow-xl" : "",
      props.class,
    )}
    onClick={props.onClick}
  >
    {props.children}
  </section>
);

export const CardBody: ParentComponent<{ class?: string }> = (props) => (
  <div class={cn("p-6", props.class)}>{props.children}</div>
);

export const CardTitle: ParentComponent<{ class?: string }> = (props) => (
  <h2 class={cn("text-lg font-semibold leading-tight", props.class)}>
    {props.children}
  </h2>
);

export const CardActions: ParentComponent<{ class?: string }> = (props) => (
  <div class={cn("mt-4 flex flex-wrap items-center gap-2", props.class)}>
    {props.children}
  </div>
);

type InputBaseProps = {
  class?: string;
};

export type InputProps = JSX.InputHTMLAttributes<HTMLInputElement> & InputBaseProps;

export function Input(props: InputProps) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <input
      {...rest}
      class={cn(
        "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-60",
        local.class,
      )}
    />
  );
}

export type TextareaProps = JSX.TextareaHTMLAttributes<HTMLTextAreaElement> &
  InputBaseProps;

export function Textarea(props: TextareaProps) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <textarea
      {...rest}
      class={cn(
        "min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-60",
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
        "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-60",
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
  | "neutral"
  | "success"
  | "destructive";

const badgeVariantClasses: Record<BadgeVariant, string> = {
  default: "border-border bg-muted text-muted-foreground",
  primary: "border-primary bg-primary text-primary-foreground",
  secondary: "border-secondary bg-secondary text-secondary-foreground",
  neutral: "border-border bg-foreground text-background",
  success: "border-success bg-success text-success-foreground",
  destructive: "border-destructive bg-destructive text-destructive-foreground",
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
        "inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-semibold",
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
  children: JSX.Element;
};

export function Dialog(props: DialogProps) {
  return (
    <Show when={props.open}>
      <div class={cn("fixed inset-0 z-50 flex items-center justify-center p-4", props.class)}>
        <button
          type="button"
          class="absolute inset-0 bg-black/50"
          onClick={props.onClose}
          aria-label="Close dialog"
        />
        <div
          class={cn(
            "relative z-10 w-full rounded-xl border border-border bg-card p-5 text-card-foreground shadow-2xl",
            props.contentClass,
          )}
        >
          {props.children}
        </div>
      </div>
    </Show>
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
