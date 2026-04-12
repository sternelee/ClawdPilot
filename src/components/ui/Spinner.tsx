/**
 * Enhanced Spinner/Loading Components
 *
 * Features:
 * - Multiple spinner styles with better animations
 * - Loading dots with staggered bounce
 * - Skeleton loaders for content areas
 * - Pulse loading effects
 * - Dashboard skeleton screens
 * - Chat skeleton screens
 */

import { type Component, Show, For, createMemo } from "solid-js";
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
  size?: "sm" | "md" | "lg";
}

export interface LoadingBarProps {
  width?: string;
  class?: string;
  animated?: boolean;
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

const dotSizes: Record<"sm" | "md" | "lg", string> = {
  sm: "w-1.5 h-1.5",
  md: "w-2 h-2",
  lg: "w-2.5 h-2.5",
};

const variantClasses: Record<SpinnerVariant, string> = {
  default: "text-muted-foreground",
  primary: "text-primary",
  secondary: "text-secondary",
  success: "text-success-content",
  warning: "text-warning-content",
  error: "text-error-content",
};

// ============================================================================
// Spinner Component (Enhanced)
// ============================================================================

export const Spinner: Component<SpinnerProps> = (props) => {
  const size = () => props.size || "md";
  const variant = () => props.variant || "default";

  return (
    <svg
      class={cn(
        "animate-spin",
        sizeClasses[size()],
        variantClasses[variant()],
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
// Loading Dots (Enhanced with staggered animation)
// ============================================================================

export const LoadingDots: Component<LoadingDotsProps> = (props) => {
  const dotSize = () => dotSizes[props.size || "md"];

  return (
    <div class={cn("flex items-center gap-1.5", props.class)}>
      <div 
        class={cn(
          "bg-muted-foreground rounded-full animate-bounce",
          dotSize()
        )} 
        style="animation-delay: 0ms" 
      />
      <div 
        class={cn(
          "bg-muted-foreground rounded-full animate-bounce",
          dotSize()
        )} 
        style="animation-delay: 150ms" 
      />
      <div 
        class={cn(
          "bg-muted-foreground rounded-full animate-bounce",
          dotSize()
        )} 
        style="animation-delay: 300ms" 
      />
    </div>
  );
};

// ============================================================================
// Loading Bar (Enhanced)
// ============================================================================

export const LoadingBar: Component<LoadingBarProps> = (props) => {
  return (
    <div class={cn("h-1 bg-base-200 rounded-full overflow-hidden", props.class)}>
      <div
        class={cn(
          "h-full bg-primary rounded-full",
          props.animated !== false && "animate-pulse"
        )}
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
  const size = () => props.size || "md";
  const variant = () => props.variant || "primary";

  return (
    <div class={cn("relative", sizeClasses[size()], props.class)}>
      <div
        class={cn(
          "absolute inset-0 rounded-full",
          "animate-ping",
          "opacity-75",
          variantClasses[variant()]
        )}
        style="background-color: currentColor"
      />
      <div
        class={cn(
          "relative rounded-full",
          variantClasses[variant()]
        )}
        style="background-color: currentColor"
      />
    </div>
  );
};

// ============================================================================
// Skeleton Loader (Enhanced)
// ============================================================================

export interface SkeletonProps {
  width?: string;
  height?: string;
  rounded?: "none" | "sm" | "md" | "lg" | "full" | "xl";
  class?: string;
}

export const Skeleton: Component<SkeletonProps> = (props) => {
  const roundedClasses = {
    none: "",
    sm: "rounded",
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    full: "rounded-full",
  };

  return (
    <div
      class={cn(
        "animate-pulse bg-base-200/70",
        "bg-gradient-to-r from-base-200/70 via-base-100 to-base-200/70",
        "bg-[length:200%_100%]",
        "animate-shimmer",
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
    <div class={cn("space-y-3 p-4 bg-base-100 rounded-xl border border-base-content/5", props.class)}>
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

// ============================================================================
// Message Bubble Skeleton
// ============================================================================

export const MessageBubbleSkeleton: Component<{ isUser?: boolean; class?: string }> = (props) => {
  return (
    <div class={cn("flex items-start gap-2", props.isUser ? "flex-row-reverse" : "flex-row", props.class)}>
      {/* Avatar */}
      <Skeleton 
        width="32px" 
        height="32px" 
        rounded="full" 
        class="shrink-0" 
      />
      
      {/* Bubble */}
      <div 
        class={cn(
          "space-y-2 max-w-[70%]",
          props.isUser ? "items-end" : "items-start"
        )}
      >
        <Skeleton 
          width="120px" 
          height="16px" 
          rounded="lg" 
        />
        <Skeleton 
          width="200px" 
          height="60px" 
          rounded="xl" 
        />
        <Skeleton 
          width="80px" 
          height="12px" 
          rounded="md" 
          class="self-end" 
        />
      </div>
    </div>
  );
};

// ============================================================================
// Chat View Skeleton (Initial Load)
// ============================================================================

export const ChatViewSkeleton: Component<{ class?: string }> = (props) => {
  return (
    <div class={cn("flex flex-col h-full", props.class)}>
      {/* Header */}
      <div class="flex items-center justify-between px-4 py-3 border-b border-base-content/10">
        <div class="flex items-center gap-3">
          <Skeleton width="36px" height="36px" rounded="lg" />
          <div class="space-y-1.5">
            <Skeleton width="100px" height="14px" />
            <Skeleton width="60px" height="10px" />
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Skeleton width="32px" height="32px" rounded="md" />
          <Skeleton width="32px" height="32px" rounded="md" />
        </div>
      </div>

      {/* Messages Area */}
      <div class="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Assistant message */}
        <MessageBubbleSkeleton />
        
        {/* User message */}
        <MessageBubbleSkeleton isUser />
        
        {/* Assistant message */}
        <MessageBubbleSkeleton />
        
        {/* Assistant message with code */}
        <div class="flex items-start gap-2">
          <Skeleton width="32px" height="32px" rounded="full" class="shrink-0" />
          <div class="space-y-2 max-w-[70%]">
            <Skeleton width="150px" height="16px" rounded="lg" />
            <Skeleton width="100%" height="120px" rounded="xl" />
            <Skeleton width="60px" height="12px" rounded="md" />
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div class="p-4 border-t border-base-content/10">
        <div class="flex items-end gap-2">
          <Skeleton width="100%" height="44px" rounded="xl" class="flex-1" />
          <Skeleton width="44px" height="44px" rounded="xl" />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Dashboard Skeleton
// ============================================================================

export const DashboardSkeleton: Component<{ class?: string }> = (props) => {
  return (
    <div class={cn("p-4 space-y-6 overflow-y-auto", props.class)}>
      {/* Header */}
      <div class="flex items-center justify-between">
        <div class="space-y-1.5">
          <Skeleton width="180px" height="24px" />
          <Skeleton width="120px" height="14px" />
        </div>
        <Skeleton width="100px" height="36px" rounded="lg" />
      </div>

      {/* Stats Cards */}
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="p-4 bg-base-100 rounded-xl border border-base-content/5 space-y-3">
          <div class="flex items-center gap-2">
            <Skeleton width="32px" height="32px" rounded="lg" />
            <Skeleton width="80px" height="12px" />
          </div>
          <Skeleton width="60px" height="24px" />
        </div>
        <div class="p-4 bg-base-100 rounded-xl border border-base-content/5 space-y-3">
          <div class="flex items-center gap-2">
            <Skeleton width="32px" height="32px" rounded="lg" />
            <Skeleton width="80px" height="12px" />
          </div>
          <Skeleton width="60px" height="24px" />
        </div>
        <div class="p-4 bg-base-100 rounded-xl border border-base-content/5 space-y-3">
          <div class="flex items-center gap-2">
            <Skeleton width="32px" height="32px" rounded="lg" />
            <Skeleton width="80px" height="12px" />
          </div>
          <Skeleton width="60px" height="24px" />
        </div>
        <div class="p-4 bg-base-100 rounded-xl border border-base-content/5 space-y-3">
          <div class="flex items-center gap-2">
            <Skeleton width="32px" height="32px" rounded="lg" />
            <Skeleton width="80px" height="12px" />
          </div>
          <Skeleton width="60px" height="24px" />
        </div>
      </div>

      {/* Sessions List */}
      <div class="space-y-3">
        <Skeleton width="100px" height="18px" />
        <div class="space-y-2">
          <div class="flex items-center gap-3 p-3 bg-base-100 rounded-xl border border-base-content/5">
            <Skeleton width="40px" height="40px" rounded="lg" />
            <div class="flex-1 space-y-1.5">
              <Skeleton width="60%" height="14px" />
              <Skeleton width="40%" height="12px" />
            </div>
            <Skeleton width="60px" height="24px" rounded="full" />
          </div>
          <div class="flex items-center gap-3 p-3 bg-base-100 rounded-xl border border-base-content/5">
            <Skeleton width="40px" height="40px" rounded="lg" />
            <div class="flex-1 space-y-1.5">
              <Skeleton width="50%" height="14px" />
              <Skeleton width="30%" height="12px" />
            </div>
            <Skeleton width="60px" height="24px" rounded="full" />
          </div>
          <div class="flex items-center gap-3 p-3 bg-base-100 rounded-xl border border-base-content/5">
            <Skeleton width="40px" height="40px" rounded="lg" />
            <div class="flex-1 space-y-1.5">
              <Skeleton width="70%" height="14px" />
              <Skeleton width="25%" height="12px" />
            </div>
            <Skeleton width="60px" height="24px" rounded="full" />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Content Area Skeleton (Generic)
// ============================================================================

export const ContentSkeleton: Component<{ lines?: number; class?: string }> = (props) => {
  const lines = () => props.lines || 5;

  return (
    <div class={cn("space-y-3", props.class)}>
      <For each={Array(lines()).fill(0)}>
        {(_, i) => (
          <Skeleton 
            width={i() === lines() - 1 ? "60%" : "100%"} 
            height="14px" 
            rounded="md" 
          />
        )}
      </For>
    </div>
  );
};

// ============================================================================
// Pulse Loading Effect (for content areas)
// ============================================================================

export const PulseLoading: Component<{ class?: string }> = (props) => {
  return (
    <div class={cn("relative overflow-hidden", props.class)}>
      <div class="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-pulse-slow" />
      <div class="relative opacity-50">{props.children}</div>
    </div>
  );
};

// ============================================================================
// Inline Loading Spinner (Small)
// ============================================================================

export const InlineSpinner: Component<{ class?: string }> = (props) => {
  return (
    <svg
      class={cn("w-4 h-4 animate-spin text-muted-foreground", props.class)}
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
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
};
