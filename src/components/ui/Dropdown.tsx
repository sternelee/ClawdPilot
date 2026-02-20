/**
 * Dropdown Menu Component
 *
 * Accessible dropdown menu with animations
 */

import { type Component, Show, For, createSignal, onMount, onCleanup, type JSX } from "solid-js";
import { cn } from "~/lib/utils";
import {
  FiChevronDown,
  FiCheck,
} from "solid-icons/fi";

// ============================================================================
// Types
// ============================================================================

export interface DropdownOption {
  id: string;
  label: string;
  description?: string;
  icon?: Component<{ size?: number; class?: string }>;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
}

export interface DropdownProps {
  options: DropdownOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  class?: string;
  trigger?: JSX.Element;
}

// ============================================================================
// Dropdown Component
// ============================================================================

export const Dropdown: Component<DropdownProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;

  // Get selected option
  const selectedOption = () => props.options.find((opt) => opt.id === props.value);

  // Close on click outside
  onMount(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef && !containerRef.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    onCleanup(() => document.removeEventListener("click", handleClickOutside));
  });

  const handleSelect = (option: DropdownOption) => {
    if (option.disabled || option.divider) return;
    props.onChange(option.id);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} class={cn("relative", props.class)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen())}
        class={cn(
          "flex items-center justify-between gap-2 px-3 py-2",
          "bg-background border border-border rounded-lg",
          "hover:border-muted-foreground/30 transition-colors",
          "text-sm min-w-[120px]"
        )}
      >
        <Show when={selectedOption()} fallback={<span class="text-muted-foreground">{props.placeholder || "Select..."}</span>}>
          <span>{selectedOption()!.label}</span>
        </Show>
        <FiChevronDown
          size={14}
          class={cn("text-muted-foreground transition-transform", isOpen() && "rotate-180")}
        />
      </button>

      {/* Dropdown Menu */}
      <Show when={isOpen()}>
        <div
          class={cn(
            "absolute z-50 mt-1 w-full min-w-[180px]",
            "bg-base-100 border border-border rounded-xl shadow-xl",
            "animate-fade-in origin-top-right overflow-hidden"
          )}
        >
          <div class="p-1 max-h-[300px] overflow-y-auto">
            <For each={props.options}>
              {(option) => (
                <Show when={!option.divider} fallback={<div class="h-px bg-border my-1" />}>
                  <button
                    type="button"
                    onClick={() => handleSelect(option)}
                    disabled={option.disabled}
                    class={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-lg",
                      "text-sm text-left transition-colors",
                      option.disabled && "opacity-50 cursor-not-allowed",
                      !option.disabled && "hover:bg-muted",
                      option.danger && "text-error hover:bg-error/10"
                    )}
                  >
                    <Show when={option.icon}>
                      <div class="text-muted-foreground shrink-0">
                        {option.icon!({ size: 16 })}
                      </div>
                    </Show>
                    <div class="flex-1 min-w-0">
                      <div class={cn(option.danger && "text-error")}>{option.label}</div>
                      <Show when={option.description}>
                        <div class="text-xs text-muted-foreground truncate">
                          {option.description}
                        </div>
                      </Show>
                    </div>
                    <Show when={option.id === props.value}>
                      <FiCheck size={14} class="text-primary shrink-0" />
                    </Show>
                  </button>
                </Show>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
};

// ============================================================================
// Select Component (simpler version)
// ============================================================================

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  class?: string;
  label?: string;
}

export const Select: Component<SelectProps> = (props) => {
  const options: DropdownOption[] = props.options.map((opt) => ({
    id: opt.value,
    label: opt.label,
  }));

  return (
    <Dropdown
      options={options}
      value={props.value}
      onChange={props.onChange}
      placeholder={props.placeholder}
      class={props.class}
    />
  );
};
