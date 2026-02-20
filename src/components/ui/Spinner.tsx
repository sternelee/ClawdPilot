/**
 * Spinner/Loading Component
 *
 * Various loading spinner styles
 */

import { type Component, Show } from "solid-js";
import { cn } from "~/lib/utils";

// ============================================================================
// Types
// ============================================================================

export type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl";
export type SpinnerVariant = "default" | "primary" | "secondary" | "success" | "warning" | "error";

export interface SpinnerProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  class?: string;
}

export interface LoadingDotsProps {
  class?: string;
}

export interface LoadingBarProps {
  width?: string;
  class?: string;
}

// ============================================================================
// Size Classes
// ============================================================================

const sizeClasses: Record<SpinnerSize, string> = {
  xs: "w-3 h-3",
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
  xl: "w-12 h-12",
};

const variantClasses: Record<SpinnerVariant, string> = {
  default: "text-muted-foreground",
  primary: "text-primary",
  secondary: "text-secondary",
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
};

// ============================================================================
// Spinner Component
// ============================================================================

export const Spinner: Component<SpinnerProps> = (props) => {
  const size = props.size || "md";
  const variant = props.variant || "default";

  return (
    <svg
      class={cn(
        "animate-spin",
        sizeClasses[size],
        variantClasses[variant],
        props.class
      )}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 3 7 5.824.938l3-2.647z"
      />
    </svg>
  );
};

// ============================================================================
// Spinner with Label
// ============================================================================

export interface SpinnerWithLabelProps {
  label?: string;
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  class?: string;
}

export const SpinnerWithLabel: Component<SpinnerWithLabelProps> = (props) => {
  return (
    <div class={cn("flex items-center gap-2", props.class)}>
      <Spinner size={props.size} variant={props.variant} />
      <Show when={props.label}>
        <span class="text-sm text-muted-foreground">{props.label}</span>
      </Show>
    </div>
  );
};

// ============================================================================
// Loading Dots
// ============================================================================

export const LoadingDots: Component<LoadingDotsProps> = (props) => {
  return (
    <div class={cn("flex items-center gap-1", props.class)}>
      <div class="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style="animation-delay: 0ms" />
      <div class="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style="animation-delay: 150ms" />
      <div class="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style="animation-delay: 300ms" />
    </div>
  );
};

// ============================================================================
// Loading Bar
// ============================================================================

export const LoadingBar: Component<LoadingBarProps> = (props) => {
  return (
    <div class={cn("h-1 bg-muted rounded-full overflow-hidden", props.class)}>
      <div
        class="h-full bg-primary rounded-full animate-pulse"
        style={{ width: props.width || "30%" }}
      />
    </div>
  );
};

// ============================================================================
// Pulse Ring (for emphasis)
// ============================================================================

export interface PulseRingProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  class?: string;
}

export const PulseRing: Component<PulseRingProps> = (props) => {
  const size = props.size || "md";
  const variant = props.variant || "primary";

  return (
    <div class={cn("relative", sizeClasses[size], props.class)}>
      <div
        class={cn(
          "absolute inset-0 rounded-full",
          "animate-ping",
          "opacity-75",
          variantClasses[variant]
        )}
        style="background-color: currentColor"
      />
      <div
        class={cn(
          "relative rounded-full",
          variantClasses[variant]
        )}
        style="background-color: currentColor"
      />
    </div>
  );
};

// ============================================================================
// Skeleton Loader
// ============================================================================

export interface SkeletonProps {
  width?: string;
  height?: string;
  rounded?: "none" | "sm" | "md" | "lg" | "full";
  class?: string;
}

export const Skeleton: Component<SkeletonProps> = (props) => {
  const roundedClasses = {
    none: "",
    sm: "rounded",
    md: "rounded-md",
    lg: "rounded-lg",
    full: "rounded-full",
  };

  return (
    <div
      class={cn(
        "animate-pulse bg-muted",
        roundedClasses[props.rounded || "md"],
        props.class
      )}
      style={{
        width: props.width || "100%",
        height: props.height || "1rem",
      }}
    />
  );
};

// ============================================================================
// Card Skeleton
// ============================================================================

export const CardSkeleton: Component<{ class?: string }> = (props) => {
  return (
    <div class={cn("space-y-3 p-4 bg-base-100 rounded-xl border border-border", props.class)}>
      <div class="flex items-center gap-3">
        <Skeleton width="40px" height="40px" rounded="full" />
        <div class="flex-1 space-y-2">
          <Skeleton width="60%" height="14px" />
          <Skeleton width="40%" height="12px" />
        </div>
      </div>
      <Skeleton height="60px" />
      <div class="flex gap-2">
        <Skeleton width="80px" height="32px" />
        <Skeleton width="80px" height="32px" />
      </div>
    </div>
  );
};
