import { createSignal, createEffect, onCleanup, Show, JSX } from "solid-js";
import { MobileKeyboard, KeyboardInfo, getDeviceCapabilities } from "../../utils/mobile";

interface KeyboardAwareContainerProps {
  children: JSX.Element;
  class?: string;
  onKeyboardShow?: (keyboardInfo: KeyboardInfo) => void;
  onKeyboardHide?: () => void;
  adjustHeight?: boolean;
  preserveContent?: boolean;
  enablePullToHide?: boolean;
  minHeight?: number;
}

export function KeyboardAwareContainer(props: KeyboardAwareContainerProps) {
  const [keyboardVisible, setKeyboardVisible] = createSignal(false);
  const [keyboardHeight, setKeyboardHeight] = createSignal(0);
  const [effectiveHeight, setEffectiveHeight] = createSignal(window.innerHeight);
  const [isPulling, setIsPulling] = createSignal(false);
  const [pullDistance, setPullDistance] = createSignal(0);

  const deviceCapabilities = getDeviceCapabilities();
  const isMobile = deviceCapabilities.isMobile;

  let containerRef: HTMLDivElement | undefined;
  let touchStartY = 0;
  let touchStartTime = 0;
  let pullToHideThreshold = 100; // pixels
  let maxPullDistance = 200; // pixels

  // Handle keyboard visibility changes
  createEffect(() => {
    const unsubscribe = MobileKeyboard.onVisibilityChange((visible, keyboardInfo) => {
      setKeyboardVisible(visible);
      if (visible && keyboardInfo) {
        setKeyboardHeight(keyboardInfo.height);
        setEffectiveHeight(keyboardInfo.viewportHeight - (keyboardInfo.viewportOffsetTop || 0));
        props.onKeyboardShow?.(keyboardInfo);
      } else {
        setKeyboardHeight(0);
        setEffectiveHeight(window.innerHeight);
        props.onKeyboardHide?.();
      }
    });

    onCleanup(() => {
      unsubscribe();
    });
  });

  // Handle pull-to-hide keyboard gesture
  const handleTouchStart = (e: TouchEvent) => {
    if (!props.enablePullToHide || !keyboardVisible()) return;

    const touch = e.touches[0];
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
    setIsPulling(true);
    setPullDistance(0);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!props.enablePullToHide || !isPulling() || !keyboardVisible()) return;

    const touch = e.touches[0];
    const deltaY = touch.clientY - touchStartY;

    // Only allow downward pull when keyboard is visible
    if (deltaY > 0) {
      const distance = Math.min(deltaY, maxPullDistance);
      setPullDistance(distance);

      // Provide haptic feedback when threshold is reached
      if (distance >= pullToHideThreshold && !navigator.vibrate) {
        navigator.vibrate(10);
      }
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (!props.enablePullToHide || !isPulling()) return;

    const distance = pullDistance();
    const duration = Date.now() - touchStartTime;

    // Hide keyboard if pulled beyond threshold or with quick gesture
    if (distance >= pullToHideThreshold || (distance > 50 && duration < 200)) {
      MobileKeyboard.hide();
      // Add success haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([20, 10, 20]);
      }
    }

    // Reset pull state
    setIsPulling(false);
    setPullDistance(0);
  };

  // Calculate container height based on keyboard state
  const getContainerHeight = () => {
    if (!props.adjustHeight) return undefined;

    const baseHeight = effectiveHeight();
    const minHeight = props.minHeight || 200;

    // Apply pull distance effect if pulling
    if (isPulling() && keyboardVisible()) {
      const pullRatio = pullDistance() / maxPullDistance;
      const heightReduction = pullRatio * keyboardHeight() * 0.5;
      return Math.max(baseHeight - heightReduction, minHeight);
    }

    return Math.max(baseHeight, minHeight);
  };

  // Get container styles
  const getContainerStyles = () => {
    const styles: any = {};

    if (props.adjustHeight) {
      styles.height = `${getContainerHeight()}px`;
      styles.maxHeight = `${getContainerHeight()}px`;
      styles.transition = isPulling()
        ? 'none'
        : 'height 0.2s cubic-bezier(0.4, 0, 0.2, 1), max-height 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
    }

    if (isPulling() && keyboardVisible()) {
      styles.transform = `translateY(${pullDistance() * 0.3}px)`;
      styles.transition = 'transform 0.1s ease-out';
    }

    return styles;
  };

  // Render pull-to-hide indicator
  const renderPullIndicator = () => {
    if (!props.enablePullToHide || !keyboardVisible() || !isPulling()) return null;

    const pullRatio = pullDistance() / pullToHideThreshold;
    const opacity = Math.min(pullRatio, 1);
    const scale = 0.8 + (pullRatio * 0.4);

    return (
      <div
        class="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
        style={{
          transform: `translateY(${pullDistance() + 20}px)`,
          opacity,
          transition: 'opacity 0.1s ease-out'
        }}
      >
        <div
          class="bg-base-100 rounded-full p-3 shadow-lg"
          style={{ transform: `scale(${scale})` }}
        >
          <div class="text-center">
            <div class="text-2xl mb-1">⬇️</div>
            <div class="text-xs text-base-content/70">
              {pullDistance() >= pullToHideThreshold ? "Release to hide keyboard" : "Pull to hide keyboard"}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      class={`relative overflow-hidden ${props.class || ""}`}
      style={getContainerStyles()}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-hide indicator */}
      <Show when={isMobile}>
        {renderPullIndicator()}
      </Show>

      {/* Content container with keyboard-aware padding */}
      <div
        class="h-full"
        classList={{
          "pb-safe-bottom": keyboardVisible() && props.preserveContent,
          "transition-all duration-200": !isPulling()
        }}
      >
        {props.children}
      </div>

      {/* Keyboard overlay for better UX */}
      <Show when={keyboardVisible() && props.preserveContent}>
        <div
          class="absolute bottom-0 left-0 right-0 bg-base-100/80 backdrop-blur-sm"
          style={{ height: `${keyboardHeight()}px` }}
        >
          <div class="flex items-center justify-center h-full">
            <div class="text-sm text-base-content/60">
              Keyboard active - swipe down to hide
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

// Keyboard-aware input component
interface KeyboardAwareInputProps {
  value: string;
  onInput: (value: string) => void;
  placeholder?: string;
  type?: "text" | "password" | "email" | "url";
  class?: string;
  autoFocus?: boolean;
  onEnter?: () => void;
  icon?: string;
  label?: string;
  error?: string;
  preserveSpace?: boolean;
}

export function KeyboardAwareInput(props: KeyboardAwareInputProps) {
  const [isFocused, setIsFocused] = createSignal(false);
  let inputRef: HTMLInputElement | undefined;

  createEffect(() => {
    if (props.autoFocus && inputRef) {
      // Delay focus to ensure keyboard detection is ready
      setTimeout(() => {
        inputRef?.focus();
      }, 100);
    }
  });

  const handleFocus = () => {
    setIsFocused(true);
    // Ensure input is visible when keyboard appears
    setTimeout(() => {
      MobileKeyboard.forceScrollAdjustment();
    }, 100);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && props.onEnter) {
      props.onEnter();
    }
  };

  return (
    <div class={`form-control w-full ${props.class || ""}`}>
      <Show when={props.label}>
        <label class="label">
          <span class="label-text font-medium">{props.label}</span>
        </label>
      </Show>

      <div class="relative">
        <Show when={props.icon}>
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span class="text-base-content/50">{props.icon}</span>
          </div>
        </Show>

        <input
          ref={inputRef}
          type={props.type || "text"}
          placeholder={props.placeholder}
          class={`input input-bordered w-full ${props.icon ? "pl-10" : ""} ${props.error ? "input-error" : ""} ${isFocused() ? "input-focus" : ""}`}
          value={props.value}
          onInput={(e) => props.onInput(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          classList={{
            "text-base": true,
            "mobile-input-optimized": true
          }}
        />
      </div>

      <Show when={props.error}>
        <label class="label">
          <span class="label-text-alt text-error">{props.error}</span>
        </label>
      </Show>

      {/* Preserve space for keyboard when focused */}
      <Show when={props.preserveSpace && isFocused()}>
        <div class="h-20" aria-hidden="true"></div>
      </Show>
    </div>
  );
}

// Mobile-optimized button with keyboard awareness
interface KeyboardAwareButtonProps {
  children: JSX.Element;
  onClick: () => void;
  variant?: "primary" | "secondary" | "accent" | "ghost" | "outline";
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  class?: string;
  fullWidth?: boolean;
  haptic?: boolean;
  keyboardAware?: boolean;
}

export function KeyboardAwareButton(props: KeyboardAwareButtonProps) {
  const handleClick = () => {
    // Hide keyboard if visible and button is keyboard-aware
    if (props.keyboardAware && MobileKeyboard.isKeyboardVisible()) {
      MobileKeyboard.hide();
    }

    // Add haptic feedback
    if (props.haptic && navigator.vibrate) {
      navigator.vibrate(10);
    }

    props.onClick();
  };

  const getVariantClass = () => {
    switch (props.variant) {
      case "primary": return "btn-primary";
      case "secondary": return "btn-secondary";
      case "accent": return "btn-accent";
      case "ghost": return "btn-ghost";
      case "outline": return "btn-outline";
      default: return "btn-primary";
    }
  };

  const getSizeClass = () => {
    switch (props.size) {
      case "xs": return "btn-xs";
      case "sm": return "btn-sm";
      case "md": return "btn-md";
      case "lg": return "btn-lg";
      default: return "btn-md";
    }
  };

  return (
    <button
      class={`btn ${getVariantClass()} ${getSizeClass()} ${props.fullWidth ? "w-full" : ""} ${props.class || ""} mobile-button-optimized`}
      onClick={handleClick}
      disabled={props.disabled || props.loading}
      classList={{
        "loading": props.loading
      }}
    >
      {props.children}
    </button>
  );
}
