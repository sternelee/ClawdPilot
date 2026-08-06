/**
 * Permission Panel Component
 *
 * Inline permission display for chat view with mobile-first design.
 */

import { type Component, For, Switch, Match } from "solid-js";
import { PermissionMessage } from "../ui/PermissionCard";
import { styleStore } from "~/stores/styleStore";
import type { PermissionRequest } from "~/stores/chatStore";

interface PermissionPanelProps {
  permissions: PermissionRequest[];
  permissionMode: "AlwaysAsk" | "AcceptEdits" | "Plan" | "AutoApprove";
  disabled?: boolean;
  onApprove: (requestId: string, decision?: "Approved" | "ApprovedForSession" | "Abort") => void;
  onDeny: (requestId: string) => void;
}

const permissionMessage = (props: PermissionPanelProps, permission: PermissionRequest) => (
  <PermissionMessage
    toolName={permission.toolName}
    toolParams={permission.toolParams}
    message={permission.description}
    requestId={permission.id}
    permissionMode={props.permissionMode}
    disabled={props.disabled}
    onApprove={(decision) => props.onApprove(permission.id, decision)}
    onDeny={() => props.onDeny(permission.id)}
  />
);

export const PermissionPanel: Component<PermissionPanelProps> = (props) => {
  const style = () => styleStore.currentStyle();

  return (
    <div class="space-y-3 px-3 sm:px-4 py-3">
      <For each={props.permissions}>
        {(permission) => (
          <Switch>
            <Match when={style() === "claude"}>
              <div
                role="group"
                aria-label="Permission request"
                class="rounded-[var(--as-radius,0.25rem)]"
              >
                {permissionMessage(props, permission)}
              </div>
            </Match>
            <Match when={style() === "codex"}>
              <div
                class="border border-[hsl(var(--bc)/0.1)] rounded-[var(--as-radius,0.5rem)] p-3"
              >
                {permissionMessage(props, permission)}
              </div>
            </Match>
            <Match when={style() === "grok"}>
              <div class="bg-[hsl(var(--b2)/0.4)] border border-[hsl(var(--bc)/0.08)] rounded-2xl p-4 text-center">
                {permissionMessage(props, permission)}
              </div>
            </Match>
          </Switch>
        )}
      </For>
    </div>
  );
};
