/**
 * Tooltip Component
 *
 * Accessible tooltip with positioning
 */

import { type Component, Show, createSignal, onCleanup, type JSX } from "solid-js";
import { cn } from "~/lib/utils";

// ============================================================================
// Types
// ============================================================================

export type TooltipPosition = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  content: JSX.Element;
  children: JSX.Element;
  position?: TooltipPosition;
  delay?: number;
  class?: string;
}

// ============================================================================
// Tooltip Component
// ============================================================================

export const Tooltip: Component<TooltipProps> = (props) => {
  const [isVisible, setIsVisible] = createSignal(false);
  let triggerRef: HTMLDivElement | undefined;
  let timeoutId: number | undefined;

  const position = props.position || "top";

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowClasses = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-border",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-border",
    left: "left-full top-1/2 -translate-y-1/2 border-l-border",
    right: "right-full top-1/2 -translate-y-1/2 border-r-border",
  };

  const handleMouseEnter = () => {
    const delay = props.delay || 300;
    timeoutId = window.setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    setIsVisible(false);
  };

  onCleanup(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });

  return (
    <div
      ref={triggerRef}
      class={cn("relative inline-flex", props.class)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {props.children}

      {/* Tooltip */}
      <Show when={isVisible()}>
        <div
          class={cn(
            "absolute z-50 px-2 py-1 text-xs font-medium",
            "bg-base-300 border border-border rounded-lg shadow-md whitespace-nowrap",
            "animate-fade-in",
            positionClasses[position]
          )}
        >
          {props.content}
          {/* Arrow */}
          <div
            class={cn(
              "absolute w-0 h-0 border-4 border-transparent",
              arrowClasses[position]
            )}
          />
        </div>
      </Show>
    </div>
  );
};

// ============================================================================
// Tooltip Provider (for managing tooltips)
// ============================================================================

export interface TooltipProviderProps {
  children: JSX.Element;
  delayDuration?: number;
}

export const TooltipProvider: Component<TooltipProviderProps> = (props) => {
  return <>{props.children}</>;
};
