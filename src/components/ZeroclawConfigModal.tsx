import { For, Show } from "solid-js";
import { sessionStore } from "../stores/sessionStore";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Label } from "./ui/label";
import { Input, Textarea } from "./ui/primitives";

interface ZeroclawConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Available tools (desktop only)
const availableTools = [
  { id: "shell", label: "Shell (执行 shell 命令)" },
  { id: "file_read", label: "File Read (读取文件)" },
  { id: "file_write", label: "File Write (写入文件)" },
  { id: "enhanced_screenshot", label: "Screenshot (截图)" },
  { id: "git_operations", label: "Git Operations (Git 操作)" },
  { id: "http_request", label: "HTTP Request (HTTP 请求)" },
  { id: "image_info", label: "Image Info (图片信息)" },
  { id: "memory_store", label: "Memory Store (记忆存储)" },
  { id: "memory_recall", label: "Memory Recall (记忆检索)" },
  { id: "memory_forget", label: "Memory Forget (记忆删除)" },
  { id: "browser", label: "Browser (浏览器控制)" },
  { id: "browser_open", label: "Browser Open (打开浏览器)" },
  { id: "composio", label: "Composio (Composio 集成)" },
];

export function ZeroclawConfigModal(props: ZeroclawConfigModalProps) {
  // Get current state
  const state = () => sessionStore.state;

  return (
    <Show when={props.isOpen}>
      <Dialog
        open={props.isOpen}
        onClose={props.onClose}
        contentClass="w-11/12 max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        <h3 class="text-lg font-bold">ClawdAI 配置</h3>

        <div class="space-y-6 py-4">
          {/* System Prompt Section */}
          <div class="rounded-lg border border-border p-4 space-y-4">
            <h4 class="font-semibold">System Prompt</h4>
            <Textarea
              value={state().zeroClawSystemPrompt}
              onInput={(e) =>
                sessionStore.setZeroClawSystemPrompt(e.currentTarget.value)
              }
              placeholder="Enter custom system prompt..."
              rows={4}
            />
          </div>

          {/* Model Settings Section */}
          <div class="rounded-lg border border-border p-4 space-y-4">
            <h4 class="font-semibold">Model Settings</h4>
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label>Temperature</Label>
                <Input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={state().zeroClawTemperature}
                  onInput={(e) =>
                    sessionStore.setZeroClawTemperature(e.currentTarget.value)
                  }
                />
              </div>

              <div class="space-y-2">
                <Label>Max Iterations</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={state().zeroClawMaxIterations}
                  onInput={(e) =>
                    sessionStore.setZeroClawMaxIterations(
                      parseInt(e.currentTarget.value) || 20,
                    )
                  }
                />
              </div>
            </div>
          </div>

          {/* Tools Section */}
          <div class="rounded-lg border border-border p-4 space-y-4">
            <div class="flex items-center justify-between">
              <h4 class="font-semibold">Tools</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Select all tools
                  sessionStore.setZeroClawEnabledTools(
                    availableTools.map((t) => t.id),
                  );
                }}
              >
                全选
              </Button>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
              <For each={availableTools}>
                {(tool) => (
                  <div
                    class="flex items-center gap-2 p-2 rounded border border-border hover:bg-muted transition-colors cursor-pointer"
                    onClick={() => sessionStore.toggleZeroClawTool(tool.id)}
                  >
                    <input
                      type="checkbox"
                      checked={state().zeroClawEnabledTools.includes(tool.id)}
                      onChange={() => {}}
                      class="checkbox checkbox-sm"
                    />
                    <span class="text-sm">{tool.label}</span>
                  </div>
                )}
              </For>
            </div>

            <Show when={state().zeroClawEnabledTools.length === 0}>
              <p class="text-warning text-sm">
                请至少选择一个工具
              </p>
            </Show>
          </div>
        </div>

        <div class="flex justify-between gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              // Reset to defaults
              sessionStore.setZeroClawSystemPrompt("");
              sessionStore.setZeroClawEnabledTools([
                "shell",
                "file_read",
                "file_write",
              ]);
            }}
          >
            重置
          </Button>
          <Button variant="default" onClick={props.onClose}>
            保存
          </Button>
        </div>
      </Dialog>
    </Show>
  );
}
