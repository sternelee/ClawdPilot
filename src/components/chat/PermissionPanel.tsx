/**
 * Permission Panel Component
 *
 * Inline permission display for chat view with mobile-first design.
 */

import { type Component, For } from "solid-js";
import { PermissionMessage } from "../ui/PermissionCard";
import type { PermissionRequest } from "~/stores/chatStore";

interface PermissionPanelProps {
  permissions: PermissionRequest[];
  permissionMode: "AlwaysAsk" | "AcceptEdits" | "Plan" | "AutoApprove";
  disabled?: boolean;
  onApprove: (requestId: string, decision?: "Approved" | "ApprovedForSession" | "Abort") => void;
  onDeny: (requestId: string) => void;
}

export const PermissionPanel: Component<PermissionPanelProps> = (props) => {
  return (
    <div class="space-y-3 px-3 sm:px-4 py-3">
      <For each={props.permissions}>
        {(permission) => (
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
        )}
      </For>
    </div>
  );
};
