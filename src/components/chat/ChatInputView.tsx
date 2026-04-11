/**
 * Chat Input View Component
 *
 * Wrapper for ChatInput with mobile-optimized container.
 */

import { type Component, createSignal, createEffect } from "solid-js";
import { ChatInput } from "../ui/ChatInput";
import { cn } from "~/lib/utils";
import { isMobile } from "~/stores/deviceStore";
import { MobileKeyboard } from "~/utils/mobile";

interface ChatInputViewProps {
  value: string;
  onInput: (value: string) => void;
  onSubmit: () => void;
  onInterrupt?: () => void;
  onAttach?: (files: File[]) => void;
  attachments?: File[];
  placeholder?: string;
  disabled?: boolean;
  isStreaming?: boolean;
  permissionMode?: "AlwaysAsk" | "AcceptEdits" | "Plan" | "AutoApprove";
  onPermissionModeChange?: (mode: "AlwaysAsk" | "AcceptEdits" | "Plan" | "AutoApprove") => void;
  rightPanelView?: "none" | "file" | "git";
  onToggleFileBrowser?: () => void;
  onToggleGitPanel?: () => void;
  mentionSuggestions?: { name: string; path: string }[];
  onSelectMention?: (path: string) => void;
  onDismissMentions?: () => void;
  slashSuggestions?: { name: string; description?: string; value?: string }[];
  onSelectSlash?: (name: string) => void;
  onDismissSlash?: () => void;
}

export const ChatInputView: Component<ChatInputViewProps> = (props) => {
  const mobile = () => isMobile();
  const [keyboardHeight, setKeyboardHeight] = createSignal(0);

  createEffect(() => {
    if (mobile()) {
      const unsubscribe = MobileKeyboard.onVisibilityChange((visible, info) => {
        if (visible && info) {
          setKeyboardHeight(info.height);
        } else {
          setKeyboardHeight(0);
        }
      });
      return unsubscribe;
    }
  });

  return (
    <div
      class={cn(
        "w-full transition-all duration-300",
        mobile() && keyboardHeight() > 0 && "pb-safe",
      )}
      style={{
        "padding-bottom": mobile() && keyboardHeight() > 0
          ? `max(env(safe-area-inset-bottom, 0px), ${keyboardHeight()}px)`
          : undefined,
      }}
    >
      <ChatInput
        value={props.value}
        onInput={props.onInput}
        onSubmit={props.onSubmit}
        onInterrupt={props.onInterrupt}
        onAttach={props.onAttach}
        attachments={props.attachments}
        placeholder={props.placeholder}
        disabled={props.disabled}
        isStreaming={props.isStreaming}
        permissionMode={props.permissionMode}
        onPermissionModeChange={props.onPermissionModeChange}
        rightPanelView={props.rightPanelView}
        onToggleFileBrowser={props.onToggleFileBrowser}
        onToggleGitPanel={props.onToggleGitPanel}
        mentionSuggestions={props.mentionSuggestions}
        onSelectMention={props.onSelectMention}
        onDismissMentions={props.onDismissMentions}
        slashSuggestions={props.slashSuggestions}
        onSelectSlash={props.onSelectSlash}
        onDismissSlash={props.onDismissSlash}
      />
    </div>
  );
};
