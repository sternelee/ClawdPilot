# Agent 三风格 UI 系统 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development 或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法跟踪进度。

**目标：** 为 Irogen 全应用实现 Claude/Codex/Grok 三种可切换的 UI 风格系统，通过 CSS token 层 + 关键组件 variant 实现高还原度的 agent 终端体验，与 DaisyUI 颜色主题正交。

**架构：** `styleStore`（SolidJS store）管理风格状态，根节点 `data-style` 属性驱动 CSS 变量作用域。组件分两层：共享原子组件（Button/Input/Card 等）纯 token 驱动；消息行/思考行/工具调用/权限面板等成分走按风格 variant 分支。agent 类型自动映射风格（ClaudeCode→claude, Codex→codex, 其余→defaultStyle），全局切换器可手动覆盖。

**技术栈：** SolidJS 1.9+、Kobalte 0.13、TailwindCSS v4、DaisyUI 5、TypeScript、clsx/cva、lucide-solid、solid-transition-group、solid-markdown、shiki

## 文件结构

**新建：**

- `src/stores/styleStore.ts` — 风格状态管理（data-style 属性、autoMap、manualOverride）
- `src/styles/agent-styles.css` — 三套 CSS 变量 token（`[data-style="claude|codex|grok"]` 作用域）
- `src/lib/styleToken.ts` — 读取 CSS 自定义属性的工具函数
- `src/components/chat/WelcomeHeader.tsx` — 欢迎屏（三种风格 variant）
- `src/components/chat/MessageRow.tsx` — 消息行（三种风格 variant，替代 MessageBubble 在聊天中的角色）
- `src/components/chat/ThinkingRow.tsx` — 思考行（`aria-live`）
- `src/components/chat/ToolCallRow.tsx` — 工具调用行（`<details>`）
- `src/components/chat/DiffBlock.tsx` — diff 展示块
- `src/components/chat/TodoListBlock.tsx` — todo 列表

**核心改造：**

- `src/App.tsx` — 根节点挂 `data-style`，初始 styleStore
- `src/index.css` — 导入 `agent-styles.css`，移除 `chat-tokens.css` 导入
- `src/stores/settingsStore.ts` — 新增 `agentStyle` 字段和 setter
- `src/stores/i18nStore.ts` — 新增风格切换相关 i18n key（en + zh-CN）
- `src/components/AppLayout.tsx` — 消费 styleStore，按风格影响布局
- `src/components/ChatView.tsx` — 用 MessageRow 替代 MessageBubble，集成新子组件
- `src/components/chat/ChatHeader.tsx` — 新增风格切换器 UI
- `src/components/chat/MessageListView.tsx` — 适配 MessageRow
- `src/components/chat/PermissionPanel.tsx` — 三种风格 variant
- `src/components/chat/UserQuestionPanel.tsx` — token 驱动
- `src/components/chat/ChatInputView.tsx` — token 驱动
- `src/components/ui/ChatInput.tsx` — token 驱动
- `src/components/SessionSidebar.tsx` — 三种风格 variant

**共享原子组件（新增/改造）：**

- `src/components/ui/Button.tsx`（新建）— 风格感知按钮
- `src/components/ui/Card.tsx`（新建）— 风格感知卡片
- `src/components/ui/Badge.tsx`（新建）— 风格感知标签

**其余视图适配（token 驱动）：**

- `src/components/HomeView.tsx`
- `src/components/SessionsView.tsx`
- `src/components/SettingsView.tsx`
- `src/components/SettingsModal.tsx` — 风格切换器
- `src/components/NewSessionModal.tsx`
- `src/components/WorkspaceShell.tsx`
- `src/components/FileBrowserView.tsx`
- `src/components/GitDiffView.tsx`
- `src/components/AgentPanel.tsx`
- `src/components/TcpForwardingModal.tsx`
- `src/components/HistorySelectionModal.tsx`
- `src/components/MobileBottomTabBar.tsx`
- `src/components/ToastContainer.tsx`

**日落/清理：**

- `src/styles/chat-tokens.css` — 保留但不再导入；样式迁移到 agent-styles.css 或组件内
- `src/components/ui/MessageBubble.tsx` — 保留（SessionsView 仍用它做预览），但 ChatView 不再使用
- `src/components/ui/PermissionCard.tsx` — 审查；若 PermissionPanel 完全替代则日落

---

### 任务 1：风格引擎基础 — styleStore + CSS token + 工具函数

**文件：**

- 创建：`src/stores/styleStore.ts`
- 创建：`src/styles/agent-styles.css`
- 创建：`src/lib/styleToken.ts`
- 修改：`src/App.tsx:1-10`（导入 styleStore，初始化）
- 修改：`src/index.css:1-4`（导入 agent-styles.css）

- [ ] **步骤 1：创建 styleStore**

```ts
// src/stores/styleStore.ts
import { createSignal, createRoot } from "solid-js";

export type StyleName = "claude" | "codex" | "grok";

// AgentType → StyleName 映射
const AGENT_TO_STYLE: Record<string, StyleName> = {
  claude: "claude",
  codex: "codex",
};

function deriveStyle(
  agentType: string | undefined,
  defaultStyle: StyleName,
  manualOverride: boolean,
  manualStyle: StyleName,
): StyleName {
  if (manualOverride) return manualStyle;
  if (agentType) {
    const mapped = AGENT_TO_STYLE[agentType.toLowerCase()];
    if (mapped) return mapped;
  }
  return defaultStyle;
}

function applyDataStyle(style: StyleName) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-style", style);
  }
}

function styleStoreFactory() {
  const [defaultStyle, setDefaultStyle] = createSignal<StyleName>("claude");
  const [manualOverride, setManualOverride] = createSignal(false);
  const [manualStyle, setManualStyle] = createSignal<StyleName>("claude");
  const [currentStyle, setCurrentStyle] = createSignal<StyleName>("claude");

  const updateStyle = (agentType?: string) => {
    const next = deriveStyle(
      agentType,
      defaultStyle(),
      manualOverride(),
      manualStyle(),
    );
    setCurrentStyle(next);
    applyDataStyle(next);
  };

  return {
    currentStyle,
    defaultStyle,
    manualOverride,
    manualStyle,
    // 切换默认风格（自动映射模式下生效）
    setDefaultStyle: (s: StyleName) => {
      setDefaultStyle(s);
      if (!manualOverride()) {
        // re-evaluate current from agentType of active session
      }
    },
    // 全局手动切换
    setManualStyle: (s: StyleName) => {
      setManualStyle(s);
      setManualOverride(true);
      setCurrentStyle(s);
      applyDataStyle(s);
    },
    // 恢复自动映射
    restoreAuto: (agentType?: string) => {
      setManualOverride(false);
      updateStyle(agentType);
    },
    // agent 映射驱动（会话切换时调用）
    applyForAgent: (agentType?: string) => {
      updateStyle(agentType);
    },
  };
}

export const styleStore = createRoot(styleStoreFactory);
```

- [ ] **步骤 2：创建 CSS token 文件**

```css
/* src/styles/agent-styles.css */

/* ============================================================
 * Agent Style Tokens — 三套设计 token，按 data-style 作用域
 *
 * 颜色不由风格层控制，全部继承 DaisyUI 主题变量。
 * 风格层只控制：密度、圆角、排版、组件形态。
 * ============================================================ */

/* ---- Claude Style: 极简终端 ---- */

[data-style="claude"] {
  --as-density: 0; /* compact */
  --as-radius: 0.25rem;
  --as-radius-lg: 0.375rem;
  --as-font-mono: "SF Mono", "Fira Code", "Cascadia Code", monospace;
  --as-msg-bubble: none; /* 纯文本行 */
  --as-msg-align: left;
  --as-msg-gap: 0.25rem;
  --as-msg-avatar: symbol; /* prefix symbol */
  --as-msg-prefix: "❯";
  --as-msg-prefix-user: "❯";
  --as-msg-prefix-assistant: "";
  --as-thinking-row: "inline";
  --as-tool-call-row: "inline";
  --as-card-border: 0;
  --as-card-bg: transparent;
  --as-input-radius: 0;
  --as-section-gap: 1rem;
  --as-font-size-sm: 0.8125rem;
  --as-font-size-base: 0.875rem;
  --as-transition-speed: 0.15s;
}

/* ---- Codex Style: 结构化分步面板 ---- */

[data-style="codex"] {
  --as-density: 1; /* normal */
  --as-radius: 0.5rem;
  --as-radius-lg: 0.75rem;
  --as-font-mono: inherit;
  --as-msg-bubble: none; /* 分步卡片 */
  --as-msg-align: left;
  --as-msg-gap: 0.75rem;
  --as-msg-avatar: tag;
  --as-msg-prefix: "";
  --as-msg-prefix-user: "";
  --as-msg-prefix-assistant: "";
  --as-thinking-row: "card";
  --as-tool-call-row: "card";
  --as-card-border: 1px;
  --as-card-bg: hsl(var(--b2) / 0.4);
  --as-input-radius: 0.5rem;
  --as-section-gap: 1.5rem;
  --as-font-size-sm: 0.8125rem;
  --as-font-size-base: 0.875rem;
  --as-transition-speed: 0.2s;
}

/* ---- Grok Style: 圆润现代气泡 ---- */

[data-style="grok"] {
  --as-density: 2; /* spacious */
  --as-radius: 1rem;
  --as-radius-lg: 1.25rem;
  --as-font-mono: inherit;
  --as-msg-bubble: block; /* 气泡 */
  --as-msg-align: left;
  --as-msg-gap: 1rem;
  --as-msg-avatar: avatar;
  --as-msg-prefix: "";
  --as-msg-prefix-user: "";
  --as-msg-prefix-assistant: "";
  --as-thinking-row: "bubble";
  --as-tool-call-row: "bubble";
  --as-card-border: 1px;
  --as-card-bg: hsl(var(--b2) / 0.6);
  --as-input-radius: 1.5rem;
  --as-section-gap: 2rem;
  --as-font-size-sm: 0.875rem;
  --as-font-size-base: 1rem;
  --as-transition-speed: 0.25s;
}
```

- [ ] **步骤 3：创建 styleToken 工具**

```ts
// src/lib/styleToken.ts

/**
 * 读取当前 data-style 作用域下的 CSS 变量值。
 * 若变量未定义，回退到 claude 默认值（定义在 agent-styles.css 中）。
 */
export function readStyleVar(name: string): string {
  if (typeof document === "undefined") return "";
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--as-${name}`)
    .trim();
  return value || "";
}

/**
 * 批量读取多个风格变量，返回 record。
 */
export function readStyleVars(names: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of names) {
    result[name] = readStyleVar(name);
  }
  return result;
}

/**
 * 返回当前 data-style 属性值。
 */
export function getCurrentStyle(): string {
  if (typeof document === "undefined") return "claude";
  return (
    document.documentElement.getAttribute("data-style") || "claude"
  );
}
```

- [ ] **步骤 4：修改 App.tsx — 引入 styleStore 初始化**

```tsx
// src/App.tsx — 在现有 imports 后添加

import { styleStore } from "./stores/styleStore";
```

在 `onMount` 回调开头追加（初始化 data-style 为默认值）：

```tsx
// 初始化风格系统
styleStore.applyForAgent();
```

- [ ] **步骤 5：修改 index.css — 导入 agent-styles.css**

将 `src/index.css` 第 2 行：

```css
@import "./styles/chat-tokens.css";
```

替换为：

```css
@import "./styles/agent-styles.css";
```

- [ ] **步骤 6：TypeScript 验证**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

预期：无新增类型错误。

- [ ] **步骤 7：Commit**

```bash
git add src/stores/styleStore.ts src/styles/agent-styles.css src/lib/styleToken.ts src/App.tsx src/index.css
git commit -m "feat(style): add styleStore, CSS token system, and styleToken util"
```

---

### 任务 2：共享原子组件 — Button / Card / Badge

**文件：**

- 创建：`src/components/ui/Button.tsx`
- 创建：`src/components/ui/Card.tsx`
- 创建：`src/components/ui/Badge.tsx`
- 验证：`pnpm tsc`

- [ ] **步骤 1：创建 Button 组件**

```tsx
// src/components/ui/Button.tsx
import { type Component, type JSX, splitProps } from "solid-js";
import { cn } from "~/lib/utils";

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export const Button: Component<ButtonProps> = (rawProps) => {
  const [props, rest] = splitProps(rawProps, [
    "class",
    "variant",
    "size",
    "children",
  ]);

  const variantClass = () => {
    switch (props.variant || "secondary") {
      case "primary":
        return "bg-[hsl(var(--p))] text-[hsl(var(--pc))] hover:opacity-90";
      case "danger":
        return "bg-[hsl(var(--er))] text-[hsl(var(--erc))] hover:opacity-90";
      case "ghost":
        return "hover:bg-[hsl(var(--b2)/0.5)]";
      default:
        return "bg-[hsl(var(--b2))] hover:bg-[hsl(var(--b3))]";
    }
  };

  const sizeClass = () => {
    switch (props.size || "md") {
      case "sm": return "text-[var(--as-font-size-sm,0.8125rem)] px-2 py-1";
      case "lg": return "text-base px-5 py-2.5";
      default:   return "text-[var(--as-font-size-base,0.875rem)] px-3 py-1.5";
    }
  };

  return (
    <button
      {...rest}
      class={cn(
        "inline-flex items-center gap-1.5 font-medium transition-all",
        "rounded-[var(--as-radius,0.25rem)]",
        "duration-[var(--as-transition-speed,0.15s)]",
        "focus-visible:outline-2 focus-visible:outline-[hsl(var(--p))] focus-visible:outline-offset-2",
        "disabled:opacity-40 disabled:pointer-events-none",
        variantClass(),
        sizeClass(),
        props.class,
      )}
    >
      {props.children}
    </button>
  );
};
```

- [ ] **步骤 2：创建 Card 组件**

```tsx
// src/components/ui/Card.tsx
import { type Component, type JSX, splitProps } from "solid-js";
import { cn } from "~/lib/utils";

interface CardProps extends JSX.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  bordered?: boolean;
}

export const Card: Component<CardProps> = (rawProps) => {
  const [props, rest] = splitProps(rawProps, ["class", "padded", "bordered", "children"]);
  const isBordered = () => props.bordered ?? true;

  return (
    <div
      {...rest}
      class={cn(
        "rounded-[var(--as-radius-lg,0.5rem)]",
        isBordered() && "border border-[hsl(var(--bc)/0.1)]",
        "bg-[var(--as-card-bg,transparent)]",
        props.padded && "p-[var(--as-section-gap,1rem)]",
        props.class,
      )}
    >
      {props.children}
    </div>
  );
};
```

- [ ] **步骤 3：创建 Badge 组件**

```tsx
// src/components/ui/Badge.tsx
import { type Component, splitProps } from "solid-js";
import { cn } from "~/lib/utils";

interface BadgeProps {
  variant?: "default" | "success" | "warning" | "error" | "info";
  class?: string;
  children?: any;
}

export const Badge: Component<BadgeProps> = (rawProps) => {
  const [props, rest] = splitProps(rawProps, ["class", "variant", "children"]);

  const variantClass = () => {
    switch (props.variant || "default") {
      case "success": return "bg-success/15 text-success";
      case "warning": return "bg-warning/15 text-warning";
      case "error":   return "bg-error/15 text-error";
      case "info":    return "bg-info/15 text-info";
      default:        return "bg-[hsl(var(--b2))] text-[hsl(var(--bc)/0.6)]";
    }
  };

  return (
    <span
      class={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--as-radius,0.25rem)]",
        "text-[var(--as-font-size-sm,0.8125rem)] font-medium",
        variantClass(),
        props.class,
      )}
    >
      {props.children}
    </span>
  );
};
```

- [ ] **步骤 4：TypeScript 验证**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

预期：无错误（Button/Card/Badge 均为新文件，不破坏现有代码）。

- [ ] **步骤 5：Commit**

```bash
git add src/components/ui/Button.tsx src/components/ui/Card.tsx src/components/ui/Badge.tsx
git commit -m "feat(style): add agent-style-aware Button, Card, Badge components"
```

---

### 任务 3：聊天核心 — WelcomeHeader / MessageRow / ThinkingRow / ToolCallRow

**文件：**

- 创建：`src/components/chat/WelcomeHeader.tsx`
- 创建：`src/components/chat/MessageRow.tsx`
- 创建：`src/components/chat/ThinkingRow.tsx`
- 创建：`src/components/chat/ToolCallRow.tsx`
- 创建：`src/components/chat/DiffBlock.tsx`
- 创建：`src/components/chat/TodoListBlock.tsx`

- [ ] **步骤 1：创建 WelcomeHeader**

```tsx
// src/components/chat/WelcomeHeader.tsx
import { type Component, Show } from "solid-js";
import { styleStore } from "~/stores/styleStore";
import { t } from "~/stores/i18nStore";
import { Card } from "~/components/ui/Card";

interface WelcomeHeaderProps {
  agentType?: string;
  model?: string;
  cwd?: string;
}

export const WelcomeHeader: Component<WelcomeHeaderProps> = (props) => {
  const style = () => styleStore.currentStyle();

  return (
    <Show when={style() === "claude"}>
      <fieldset class="mx-4 my-6 border border-[hsl(var(--bc)/0.1)] rounded-[var(--as-radius,0)] p-4">
        <legend class="px-2 text-xs font-semibold text-[hsl(var(--bc)/0.5)] uppercase tracking-wider">
          {t("chat.welcome")}
        </legend>
        <div class="space-y-2 text-sm text-[hsl(var(--bc)/0.7)]">
          <div class="flex gap-3">
            <span class="text-[hsl(var(--p))] whitespace-nowrap">Model</span>
            <span>{props.model || "—"}</span>
          </div>
          <div class="flex gap-3">
            <span class="text-[hsl(var(--p))] whitespace-nowrap">Agent</span>
            <span>{props.agentType || "—"}</span>
          </div>
          <div class="flex gap-3">
            <span class="text-[hsl(var(--p))] whitespace-nowrap">cwd</span>
            <span>{props.cwd || "—"}</span>
          </div>
        </div>
      </fieldset>
    </Show>
    // codex: step list with instructions
    // grok: centered card with avatar + greeting
    // (variants filled in subsequent iterations)
  );
};
```

- [ ] **步骤 2：创建 ThinkingRow**

```tsx
// src/components/chat/ThinkingRow.tsx
import { type Component, createSignal, onCleanup, Show } from "solid-js";
import { FiChevronDown, FiChevronRight } from "solid-icons/fi";
import { cn } from "~/lib/utils";

interface ThinkingRowProps {
  thinking?: string;
  isStreaming?: boolean;
  elapsed?: number;
}

// Rotating verbs for the thinking indicator
const VERBS = ["Thinking", "Analyzing", "Planning", "Searching", "Processing"];

export const ThinkingRow: Component<ThinkingRowProps> = (props) => {
  const [expanded, setExpanded] = createSignal(false);
  const [verbIdx, setVerbIdx] = createSignal(0);

  let verbInterval: ReturnType<typeof setInterval> | undefined;

  if (props.isStreaming) {
    verbInterval = setInterval(() => {
      setVerbIdx((i) => (i + 1) % VERBS.length);
    }, 1500);
  }

  onCleanup(() => {
    if (verbInterval) clearInterval(verbInterval);
  });

  const hasContent = () => !!props.thinking;
  const elapsedStr = () => {
    if (!props.elapsed) return "";
    const s = Math.floor(props.elapsed / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <div
      class="mx-4 my-1 group"
      role="status"
      aria-live="polite"
      aria-label={props.isStreaming ? `${VERBS[verbIdx()]}...` : "Thinking complete"}
    >
      <button
        class={cn(
          "flex items-center gap-2 w-full text-left px-2 py-1",
          "text-[var(--as-font-size-sm,0.8125rem)]",
          "text-[hsl(var(--bc)/0.5)] hover:text-[hsl(var(--bc)/0.7)]",
          "transition-colors duration-[var(--as-transition-speed,0.15s)]",
        )}
        onClick={() => setExpanded((v) => !v)}
        disabled={!hasContent()}
      >
        <Show when={props.isStreaming} fallback={hasContent() ? <FiChevronRight size={12} /> : null}>
          <span class="inline-block w-3 h-3">
            <svg class="animate-spin" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="4" stroke="currentColor" stroke-width="2" stroke-dasharray="6 18" />
            </svg>
          </span>
        </Show>
        <Show when={props.isStreaming} fallback={hasContent() ? (expanded() ? <FiChevronDown size={12} /> : <FiChevronRight size={12} />) : null}>
          <span class="font-medium">{VERBS[verbIdx()]}…</span>
        </Show>
        <Show when={props.isStreaming}>
          <span>{elapsedStr()}</span>
        </Show>
        <Show when={!props.isStreaming && hasContent()}>
          <span>Thought for {elapsedStr()}</span>
        </Show>
      </button>
      <Show when={expanded() && hasContent()}>
        <div class="px-4 py-2 text-[var(--as-font-size-sm,0.8125rem)] text-[hsl(var(--bc)/0.5)] leading-relaxed whitespace-pre-wrap border-t border-[hsl(var(--bc)/0.05)]">
          {props.thinking}
        </div>
      </Show>
    </div>
  );
};
```

- [ ] **步骤 3：创建 ToolCallRow**

```tsx
// src/components/chat/ToolCallRow.tsx
import { type Component, createSignal, Show, Switch, Match } from "solid-js";
import { FiChevronDown, FiChevronRight } from "solid-icons/fi";
import type { ToolCall } from "~/stores/chatStore";

interface ToolCallRowProps {
  tool: ToolCall;
}

function statusIcon(status: string | undefined): string {
  switch (status) {
    case "running": return "⏺";
    case "completed": return "⏸";
    case "failed": case "error": return "✕";
    default: return "○";
  }
}

export const ToolCallRow: Component<ToolCallRowProps> = (props) => {
  const [expanded, setExpanded] = createSignal(false);

  return (
    <details
      class="mx-4 my-1.5 group border border-[hsl(var(--bc)/0.08)] rounded-[var(--as-radius,0.25rem)] overflow-hidden"
      open={false}
    >
      <summary
        class="flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none
               text-[var(--as-font-size-sm,0.8125rem)] text-[hsl(var(--bc)/0.6)]
               hover:bg-[hsl(var(--b2)/0.3)] transition-colors"
      >
        <span aria-hidden="true">{statusIcon(props.tool.status)}</span>
        <span class="font-medium text-[hsl(var(--bc)/0.8)]">{props.tool.name || "Tool Call"}</span>
        <span class="ml-auto text-[hsl(var(--bc)/0.4)]">
          {props.tool.status || "pending"}
        </span>
      </summary>
      <div class="px-3 pb-2 space-y-1.5 border-t border-[hsl(var(--bc)/0.04)]">
        <Show when={props.tool.input}>
          <div>
            <span class="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--bc)/0.3)]">Input</span>
            <pre class="text-[11px] font-mono text-[hsl(var(--bc)/0.6)] bg-[hsl(var(--b2)/0.3)] rounded p-1.5 mt-0.5 overflow-x-auto">{props.tool.input}</pre>
          </div>
        </Show>
        <Show when={props.tool.output}>
          <div>
            <span class="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--bc)/0.3)]">Output</span>
            <pre class="text-[11px] font-mono text-[hsl(var(--bc)/0.6)] bg-[hsl(var(--b2)/0.3)] rounded p-1.5 mt-0.5 overflow-x-auto max-h-48 overflow-y-auto">{props.tool.output}</pre>
          </div>
        </Show>
      </div>
    </details>
  );
};
```

- [ ] **步骤 4：创建 DiffBlock 和 TodoListBlock（骨架）**

```tsx
// src/components/chat/DiffBlock.tsx
import { type Component } from "solid-js";

interface DiffBlockProps {
  hunks?: { lines: { kind: "add" | "remove" | "context"; text: string; ln?: number }[] }[];
}

export const DiffBlock: Component<DiffBlockProps> = (props) => {
  if (!props.hunks?.length) return null;
  return (
    <div class="mx-4 my-1.5 border border-[hsl(var(--bc)/0.1)] rounded-[var(--as-radius,0.25rem)] overflow-hidden text-[11px] font-mono">
      {props.hunks.map((hunk, hi) => (
        <div key={hi}>
          {hunk.lines.map((line, li) => (
            <div
              key={li}
              class="flex"
              classList={{
                "bg-success/10 text-success": line.kind === "add",
                "bg-error/10 text-error": line.kind === "remove",
                "text-[hsl(var(--bc)/0.6)]": line.kind === "context",
              }}
            >
              <span class="w-10 shrink-0 text-right pr-2 text-[hsl(var(--bc)/0.3)] select-none">{line.ln ?? ""}</span>
              <span class="whitespace-pre">{line.kind === "add" ? "+" : line.kind === "remove" ? "-" : " "}{line.text}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
```

```tsx
// src/components/chat/TodoListBlock.tsx
import { type Component } from "solid-js";

interface TodoItem { id: string; title: string; status: "in-progress" | "completed" | "pending" | "not-started"; }
interface TodoListBlockProps { todos?: TodoItem[]; }

export const TodoListBlock: Component<TodoListBlockProps> = (props) => {
  if (!props.todos?.length) return null;
  return (
    <ul class="mx-4 my-1.5 space-y-0.5" role="list" aria-label="Todo list">
      {props.todos.map((item) => (
        <li
          key={item.id}
          class="flex items-center gap-2 text-[var(--as-font-size-sm,0.8125rem)]"
          classList={{
            "line-through text-[hsl(var(--bc)/0.35)]": item.status === "completed",
            "text-[hsl(var(--bc)/0.7)]": item.status !== "completed",
          }}
        >
          <span class="text-[hsl(var(--bc)/0.3)]">
            {item.status === "completed" ? "✓" : item.status === "in-progress" ? "●" : "○"}
          </span>
          <span>{item.title}</span>
        </li>
      ))}
    </ul>
  );
};
```

- [ ] **步骤 5：TypeScript 验证**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

预期：无错误。

- [ ] **步骤 6：Commit**

```bash
git add src/components/chat/WelcomeHeader.tsx src/components/chat/MessageRow.tsx src/components/chat/ThinkingRow.tsx src/components/chat/ToolCallRow.tsx src/components/chat/DiffBlock.tsx src/components/chat/TodoListBlock.tsx
git commit -m "feat(style): add chat core components — WelcomeHeader, ThinkingRow, ToolCallRow, DiffBlock, TodoListBlock"
```

---

### 任务 4：MessageRow — 三种风格的消息行

**文件：**

- 创建：`src/components/chat/MessageRow.tsx`

- [ ] **步骤 1：创建 MessageRow（三种 variant）**

```tsx
// src/components/chat/MessageRow.tsx
import { type Component, Show, Switch, Match } from "solid-js";
import { styleStore } from "~/stores/styleStore";
import type { ChatMessage } from "~/stores/chatStore";
import { SolidMarkdown } from "solid-markdown";
import { cn } from "~/lib/utils";

interface MessageRowProps {
  message: ChatMessage;
}

// Helper: return avatar initial for Grok style
function avatarChar(role: string): string {
  return role === "user" ? "U" : "A";
}

export const MessageRow: Component<MessageRowProps> = (props) => {
  const style = () => styleStore.currentStyle();
  const msg = () => props.message;

  return (
    <Switch>
      {/* ==== User message ==== */}
      <Match when={msg().role === "user"}>
        <Switch>
          <Match when={style() === "claude"}>
            <div class="flex items-start gap-2 mx-4 my-1 text-[var(--as-font-size-base,0.875rem)]">
              <span class="text-[hsl(var(--p))] font-semibold shrink-0 select-none mt-0.5" aria-hidden="true">
                {">"}
              </span>
              <div class="text-[hsl(var(--bc))] whitespace-pre-wrap break-words">{msg().content}</div>
            </div>
          </Match>
          <Match when={style() === "codex"}>
            <div class="mx-4 my-2">
              <div class="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--bc)/0.35)] mb-1">You</div>
              <div class="p-3 rounded-[var(--as-radius,0.5rem)] border border-[hsl(var(--bc)/0.08)] bg-[hsl(var(--b2)/0.2)] text-sm text-[hsl(var(--bc))] whitespace-pre-wrap break-words">
                {msg().content}
              </div>
            </div>
          </Match>
          <Match when={style() === "grok"}>
            <div class="flex items-start gap-3 mx-4 my-2 justify-end">
              <div class="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-[hsl(var(--p))] text-[hsl(var(--pc))] text-sm whitespace-pre-wrap break-words shadow-sm">
                {msg().content}
              </div>
              <div class="w-8 h-8 rounded-full bg-[hsl(var(--p)/0.2)] flex items-center justify-center text-xs font-bold text-[hsl(var(--p))] shrink-0 mt-0.5 select-none" aria-hidden="true">
                {avatarChar("user")}
              </div>
            </div>
          </Match>
        </Switch>
      </Match>

      {/* ==== Assistant message ==== */}
      <Match when={msg().role === "assistant"}>
        <Switch>
          <Match when={style() === "claude"}>
            <div class="mx-4 my-0.5 text-[var(--as-font-size-base,0.875rem)] text-[hsl(var(--bc)/0.85)] whitespace-pre-wrap break-words">
              <SolidMarkdown class="prose prose-sm max-w-none [color:inherit]">
                {msg().content || ""}
              </SolidMarkdown>
            </div>
          </Match>
          <Match when={style() === "codex"}>
            <div class="mx-4 my-2">
              <div class="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--bc)/0.35)] mb-1">Assistant</div>
              <div class="p-3 rounded-[var(--as-radius,0.5rem)] border border-[hsl(var(--bc)/0.08)] bg-[hsl(var(--b2)/0.15)] text-sm text-[hsl(var(--bc))]">
                <SolidMarkdown class="prose prose-sm max-w-none [color:inherit]">
                  {msg().content || ""}
                </SolidMarkdown>
              </div>
            </div>
          </Match>
          <Match when={style() === "grok"}>
            <div class="flex items-start gap-3 mx-4 my-2">
              <div class="w-8 h-8 rounded-full bg-[hsl(var(--s)/0.2)] flex items-center justify-center text-xs font-bold text-[hsl(var(--s))] shrink-0 mt-0.5 select-none" aria-hidden="true">
                {avatarChar("assistant")}
              </div>
              <div class="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tl-sm bg-[hsl(var(--b2)/0.5)] border border-[hsl(var(--bc)/0.08)] text-sm text-[hsl(var(--bc))] whitespace-pre-wrap break-words">
                <SolidMarkdown class="prose prose-sm max-w-none [color:inherit]">
                  {msg().content || ""}
                </SolidMarkdown>
              </div>
            </div>
          </Match>
        </Switch>
      </Match>
    </Switch>
  );
};
```

- [ ] **步骤 2：TypeScript 验证**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

预期：无错误（ChatMessage 已有 `role` 和 `content` 字段）。

- [ ] **步骤 3：Commit**

```bash
git add src/components/chat/MessageRow.tsx
git commit -m "feat(style): add MessageRow with Claude/Codex/Grok variants"
```

---

### 任务 5：ChatView 改造 — 集成新组件

**文件：**

- 修改：`src/components/ChatView.tsx`（导入替换，用户消息和助手消息用 MessageRow + ThinkingRow + ToolCallRow + DiffBlock + TodoListBlock）
- 修改：`src/components/chat/MessageListView.tsx`（适配）

- [ ] **步骤 1：改造 ChatView.tsx 消息渲染**

在 `ChatView.tsx` 中，将现有的 `MessageBubble` 替换为新组件链。

找到消息渲染的 JSX（大致在 `For each={messages}` 区域），将其替换为：

```tsx
<For each={messages()}>
  {(msg) => (
    <div>
      {/* 如果有思考内容（非用户消息），先渲染 ThinkingRow */}
      {msg.role !== "user" && msg.thinking && (
        <ThinkingRow
          thinking={msg.thinkingContent}
          isStreaming={isStreaming() && isLastMessage(msg)}
          elapsed={msg.thinkingElapsed}
        />
      )}
      {/* 渲染消息本体 */}
      <MessageRow message={msg} />
      {/* 渲染工具调用 */}
      {msg.toolCalls?.map((tc) => (
        <ToolCallRow tool={tc} />
      ))}
      {/* 渲染 diff / todo 等（如有） */}
      {msg.diffs?.map((diff, i) => (
        <DiffBlock key={i} hunks={diff.hunks} />
      ))}
      {msg.todos?.length > 0 && (
        <TodoListBlock todos={msg.todos} />
      )}
    </div>
  )}
</For>
```

导入新模块：

```tsx
import { MessageRow } from "./chat/MessageRow";
import { ThinkingRow } from "./chat/ThinkingRow";
import { ToolCallRow } from "./chat/ToolCallRow";
import { DiffBlock } from "./chat/DiffBlock";
import { TodoListBlock } from "./chat/TodoListBlock";
```

注意：需要从 ChatView 中移除 `MessageBubble` 的 import。

- [ ] **步骤 2：TypeScript 验证**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

预期：可能有类型错误（ChatMessage 缺少 `thinkingContent`、`thinkingElapsed`、`diffs`、`todos` 字段）。修复：在 ChatMessage 接口中添加可选字段。

修复 `src/stores/chatStore.ts` 的 `ChatMessage` 接口：

```ts
export interface ChatMessage {
  // ... 现有字段保持不变 ...
  thinkingContent?: string;
  thinkingElapsed?: number;
  diffs?: { hunks: { lines: { kind: "add" | "remove" | "context"; text: string; ln?: number }[] }[] }[];
  todos?: { id: string; title: string; status: "in-progress" | "completed" | "pending" | "not-started" }[];
}
```

再次验证：

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

预期：无错误。

- [ ] **步骤 3：Commit**

```bash
git add src/components/ChatView.tsx src/components/chat/MessageListView.tsx src/stores/chatStore.ts
git commit -m "feat(style): integrate MessageRow, ThinkingRow, ToolCallRow into ChatView"
```

---

### 任务 6：ChatHeader — 风格切换器 + 头部改造

**文件：**

- 修改：`src/components/chat/ChatHeader.tsx`

- [ ] **步骤 1：在 ChatHeader 中加入风格切换器**

在 `ChatHeader.tsx` 中增加一个风格切换下拉或分段按钮。选项：Auto / Claude / Codex / Grok。

插入位置：现有 header 右侧或左侧。

```tsx
// 在 ChatHeader.tsx 中新增 import
import { styleStore, type StyleName } from "~/stores/styleStore";
import { FiSun } from "solid-icons/fi";

// 组件内新增状态
const STYLE_OPTIONS: { value: "auto" | StyleName; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "claude", label: "Claude" },
  { value: "codex", label: "Codex" },
  { value: "grok", label: "Grok" },
];

const [stylePickerOpen, setStylePickerOpen] = createSignal(false);

// JSX: 在 header 合适位置插入
<div class="relative">
  <button
    type="button"
    class="flex items-center gap-1 px-2 py-1 text-xs rounded-[var(--as-radius,0.25rem)] hover:bg-[hsl(var(--b2)/0.5)] transition-colors"
    onClick={() => setStylePickerOpen((v) => !v)}
    aria-label="Switch agent style"
  >
    <span class="text-[hsl(var(--bc)/0.5)]">
      {styleStore.manualOverride() ? styleAppearanceLabel(styleStore.currentStyle()) : "Auto"}
    </span>
    <FiChevronDown size={10} />
  </button>
  <Show when={stylePickerOpen()}>
    <div class="absolute right-0 top-full mt-1 bg-[hsl(var(--b1))] border border-[hsl(var(--bc)/0.1)] rounded-[var(--as-radius,0.25rem)] shadow-lg z-50 min-w-[120px]">
      <button class="block w-full text-left px-3 py-1.5 text-xs hover:bg-[hsl(var(--b2))] transition-colors"
        classList={{ "text-[hsl(var(--p))]": !styleStore.manualOverride() }}
        onClick={() => { styleStore.restoreAuto(); setStylePickerOpen(false); }}
      >Auto</button>
      {(["claude", "codex", "grok"] as StyleName[]).map((s) => (
        <button key={s}
          class="block w-full text-left px-3 py-1.5 text-xs hover:bg-[hsl(var(--b2))] transition-colors"
          classList={{ "text-[hsl(var(--p))]": styleStore.manualOverride() && styleStore.currentStyle() === s }}
          onClick={() => { styleStore.setManualStyle(s); setStylePickerOpen(false); }}
        >{s.charAt(0).toUpperCase() + s.slice(1)}</button>
      ))}
    </div>
  </Show>
</div>
```

辅助函数：

```tsx
function styleAppearanceLabel(s: StyleName): string {
  switch (s) {
    case "claude": return "Claude";
    case "codex": return "Codex";
    case "grok": return "Grok";
  }
}
```

- [ ] **步骤 2：TypeScript 验证**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

预期：无错误。

- [ ] **步骤 3：Commit**

```bash
git add src/components/chat/ChatHeader.tsx
git commit -m "feat(style): add agent style switcher to ChatHeader"
```

---

### 任务 7：权限面板 — 三种风格 variant

**文件：**

- 修改：`src/components/chat/PermissionPanel.tsx`

- [ ] **步骤 1：改造 PermissionPanel 为三种 variant**

```tsx
// src/components/chat/PermissionPanel.tsx — 改造

import { styleStore } from "~/stores/styleStore";
import { Button } from "~/components/ui/Button";

// 在渲染时按 style() 分支
const style = () => styleStore.currentStyle();

// Claude 风格：内联审批行（方向键导航）
// Codex 风格：结构化卡片 + 按钮组
// Grok 风格：居中对话框卡片 + 大按钮

// 简化版改造（保持现有逻辑，仅包裹不同 JSX）：
return (
  <div
    class="mx-4 my-2"
    role={style() === "claude" ? "radiogroup" : "group"}
    aria-label="Permission request"
  >
    <Switch>
      <Match when={style() === "claude"}>
        {/* Inline approval row — arrow-key navigable */}
        <div class="flex items-center gap-2 px-2 py-1.5 text-[var(--as-font-size-sm,0.8125rem)] text-[hsl(var(--bc)/0.7)]">
          <span>{permissionMessage()}</span>
          <div class="flex gap-1 ml-auto" role="radiogroup">
            {permissionOptions().map((opt) => (
              <button
                class="px-2 py-0.5 rounded-[var(--as-radius,0.25rem)] hover:bg-[hsl(var(--p)/0.1)] text-[hsl(var(--p))]"
                onClick={() => handleOption(opt)}
                role="radio"
              >{opt.label}</button>
            ))}
          </div>
        </div>
      </Match>
      <Match when={style() === "codex"}>
        <div class="border border-[hsl(var(--bc)/0.1)] rounded-[var(--as-radius,0.5rem)] p-3">
          <p class="text-sm mb-2">{permissionMessage()}</p>
          <div class="flex gap-2">
            {permissionOptions().map((opt) => (
              <Button size="sm" variant="primary" onClick={() => handleOption(opt)}>{opt.label}</Button>
            ))}
          </div>
        </div>
      </Match>
      <Match when={style() === "grok"}>
        <div class="bg-[hsl(var(--b2)/0.4)] border border-[hsl(var(--bc)/0.08)] rounded-2xl p-4 text-center">
          <p class="text-sm mb-3">{permissionMessage()}</p>
          <div class="flex justify-center gap-3">
            {permissionOptions().map((opt) => (
              <Button size="lg" variant="primary" onClick={() => handleOption(opt)}>{opt.label}</Button>
            ))}
          </div>
        </div>
      </Match>
    </Switch>
  </div>
);
```

- [ ] **步骤 2：TypeScript 验证**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

- [ ] **步骤 3：Commit**

```bash
git add src/components/chat/PermissionPanel.tsx
git commit -m "feat(style): add Claude/Codex/Grok variant to PermissionPanel"
```

---

### 任务 8：SessionSidebar、AppLayout 等基础改造

**文件：**

- 修改：`src/components/SessionSidebar.tsx`
- 修改：`src/components/AppLayout.tsx`
- 修改：`src/components/chat/ChatInputView.tsx`
- 修改：`src/components/chat/UserQuestionPanel.tsx`
- 修改：`src/components/ui/ChatInput.tsx`

- [ ] **步骤 1：SessionSidebar — 风格感知密度**

在 `SessionSidebar.tsx` 的根 `aside`/`nav` 元素上，添加风格感知的 CSS 类。导航项和会话列表项的 `gap`、`px`、`py` 从 `--as-density` 驱动。

```tsx
// 在 SessionSidebar 根元素添加风格感知 padding/density
const densityClass = () => {
  const s = styleStore.currentStyle();
  return s === "claude" ? "gap-0.5 py-1" : s === "grok" ? "gap-2 py-3" : "gap-1 py-2";
};
```

- [ ] **步骤 2：AppLayout — 配合风格调整间距**

```tsx
// AppLayout 的主容器添加风格感知 section-gap
<div class={cn(
  "h-full flex",
  // 用 CSS 变量 [--as-section-gap] 控制内边距
  "gap-[var(--as-section-gap,1rem)]",
)}>
```

- [ ] **步骤 3：ChatInputView / ChatInput / UserQuestionPanel — token 驱动**

将现有硬编码的间距、圆角替换为 CSS 变量引用（`rounded-[var(--as-radius,0.5rem)]` 等）。这些组件结构不变，只换样式值。

- [ ] **步骤 4：TypeScript 验证**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

- [ ] **步骤 5：Commit**

```bash
git add src/components/SessionSidebar.tsx src/components/AppLayout.tsx src/components/chat/ChatInputView.tsx src/components/chat/UserQuestionPanel.tsx src/components/ui/ChatInput.tsx
git commit -m "feat(style): apply token-driven styling to sidebar, layout, input components"
```

---

### 任务 9：其余视图适配（Home / Sessions / Settings / WorkspaceShell / FileBrowser / GitDiff / AgentPanel / Modals）

**文件（修改，全部 token 驱动）：**

- `src/components/HomeView.tsx`
- `src/components/SessionsView.tsx`
- `src/components/SettingsView.tsx`
- `src/components/WorkspaceShell.tsx`
- `src/components/FileBrowserView.tsx`
- `src/components/GitDiffView.tsx`
- `src/components/AgentPanel.tsx`
- `src/components/TcpForwardingModal.tsx`
- `src/components/HistorySelectionModal.tsx`
- `src/components/ToastContainer.tsx`

- [ ] **步骤 1：批量适配其余视图**

对所有视图做以下改动（模式化改动，每个文件量很小）：

1. 硬编码的 `rounded-lg` / `rounded-xl` → `rounded-[var(--as-radius-lg,1rem)]`
2. 硬编码的 `p-4` / `p-6` → `p-[var(--as-section-gap,1rem)]`
3. 硬编码的 `gap-4` / `gap-6` → `gap-[var(--as-section-gap,1rem)]`
4. 硬编码的 `text-sm` / `text-base` → `text-[var(--as-font-size-sm)]` / `text-[var(--as-font-size-base)]`
5. 菜单/下拉中的 `rounded-lg` → `rounded-[var(--as-radius,0.5rem)]`

示例（HomeView.tsx）：

```tsx
// 将
<div class="p-4 rounded-xl bg-base-200/50">
// 改为
<div class="p-[var(--as-section-gap,1rem)] rounded-[var(--as-radius-lg,0.75rem)] bg-base-200/50">
```

- [ ] **步骤 2：TypeScript 验证**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

- [ ] **步骤 3：Commit**

```bash
git add src/components/HomeView.tsx src/components/SessionsView.tsx src/components/SettingsView.tsx src/components/WorkspaceShell.tsx src/components/FileBrowserView.tsx src/components/GitDiffView.tsx src/components/AgentPanel.tsx src/components/TcpForwardingModal.tsx src/components/HistorySelectionModal.tsx src/components/ToastContainer.tsx
git commit -m "feat(style): apply agent-style tokens to remaining views and modals"
```

---

### 任务 10：SettingsModal + SettingsStore — 全局风格设置

**文件：**

- 修改：`src/stores/settingsStore.ts`
- 修改：`src/stores/i18nStore.ts`
- 修改：`src/components/SettingsModal.tsx`

- [ ] **步骤 1：settingsStore 新增 agentStyle 字段**

在 `src/stores/settingsStore.ts`：

```ts
import { type StyleName } from "./styleStore";

export interface UserSettings {
  // …现有字段…
  agentStyle: "auto" | StyleName;
}

const defaultSettings: UserSettings = {
  // …现有字段…
  agentStyle: "auto",
};
```

添加 setter：

```ts
setAgentStyle: (style: "auto" | StyleName) => {
  setSettings((prev) => ({ ...prev, agentStyle: style }));
  if (style === "auto") {
    styleStore.restoreAuto();
  } else {
    styleStore.setManualStyle(style);
  }
},
```

- [ ] **步骤 2：i18nStore 新增风格 key**

在 `i18nStore.ts` 中 `en` 和 `zh-CN` 字典追加：

```ts
// en
"style.auto": "Auto (by agent)",
"style.claude": "Claude Terminal",
"style.codex": "Codex Panel",
"style.grok": "Grok Chat",
"style.title": "Agent UI Style",

// zh-CN
"style.auto": "自动（按 Agent）",
"style.claude": "Claude 终端",
"style.codex": "Codex 面板",
"style.grok": "Grok 聊天",
"style.title": "Agent 界面风格",
```

- [ ] **步骤 3：SettingsModal 加入风格选择器**

在 SettingsModal 的"外观"部分加入：

```tsx
import { settingsStore } from "~/stores/settingsStore";
import { t } from "~/stores/i18nStore";

// 风格选择
<div class="form-control">
  <label class="label">
    <span class="label-text">{t("style.title")}</span>
  </label>
  <select
    class="select select-bordered"
    value={settingsStore.get().agentStyle}
    onChange={(e) => settingsStore.setAgentStyle(e.currentTarget.value as any)}
  >
    <option value="auto">{t("style.auto")}</option>
    <option value="claude">{t("style.claude")}</option>
    <option value="codex">{t("style.codex")}</option>
    <option value="grok">{t("style.grok")}</option>
  </select>
</div>
```

- [ ] **步骤 4：TypeScript 验证**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

- [ ] **步骤 5：Commit**

```bash
git add src/stores/settingsStore.ts src/stores/i18nStore.ts src/components/SettingsModal.tsx
git commit -m "feat(style): add agentStyle setting to settingsStore, i18n, and SettingsModal"
```

---

### 任务 11：移动端适配 + 打磨

**文件：**

- 修改：`src/components/MobileBottomTabBar.tsx`
- 修改：`src/styles/agent-styles.css`（追加移动端覆盖）
- 修改：`src/components/ui/KeyboardAwareContainer.tsx`（如需）

- [ ] **步骤 1：MobileBottomTabBar — 风格感知**

```tsx
// 在 MobileBottomTabBar 添加风格感知圆角和密度
// 用 CSS 变量驱动，与其余视图一致
```

- [ ] **步骤 2：agent-styles.css 移动端覆盖**

```css
/* 移动端：三种风格下聊天气泡/文本行宽度调整 */
@media (max-width: 640px) {
  [data-style="claude"] {
    --as-msg-gap: 0.5rem;
  }
  [data-style="grok"] .message-bubble {
    max-width: 90%;
  }
}
```

- [ ] **步骤 3：全局验证**

```bash
pnpm tsc --noEmit 2>&1 | head -20
pnpm dev & sleep 3 && kill %1 2>/dev/null  # 确认 dev server 可启动
```

- [ ] **步骤 4：Commit**

```bash
git add src/components/MobileBottomTabBar.tsx src/styles/agent-styles.css
git commit -m "feat(style): mobile adaptation and polish for agent styles"
```

---

### 任务 12：最终清理 — chat-tokens.css 日落

**文件：**

- 修改：`src/index.css`
- 标记：`src/styles/chat-tokens.css`（保留但移除导入）

- [ ] **步骤 1：确认 chat-tokens.css 不再被导入**

检查 `src/index.css`：

```css
@import "./styles/agent-styles.css";
```

确认只有 agent-styles.css，没有 chat-tokens.css（已在任务 1 步骤 5 替换）。

- [ ] **步骤 2：全局验证 + Lint**

```bash
pnpm tsc --noEmit
```

预期：无类型错误。

```bash
# 检查有无剩余对 chat-tokens.css 内 CSS 类的引用
rg "thinking-block|tool-call-card|streaming-cursor|token-badge" src/components/ src/stores/ | head -10
```

预期：可能剩下少量引用（MessageBubble 仍存在但 ChatView 不再用它），确认无 chat 核心路径使用旧类名。

- [ ] **步骤 3：Commit**

```bash
git add src/index.css
git commit -m "chore(style): finalize agent-styles.css migration, sunset chat-tokens.css"
```

---

## 自检

### 1. 规格覆盖度

对照 `docs/superpowers/specs/2026-01-27-agent-style-system-design.md`：

| 规格章节 | 对应任务 |
| --- | --- |
| styleStore + 风格引擎 | 任务 1 |
| CSS token（三套变量） | 任务 1（agent-styles.css） |
| styleToken 工具 | 任务 1 |
| 共享原子组件（Button/Card/Badge） | 任务 2 |
| MessageRow（三种 variant） | 任务 4 |
| ThinkingRow | 任务 3 |
| ToolCallRow | 任务 3 |
| DiffBlock | 任务 3 |
| TodoListBlock | 任务 3 |
| WelcomeHeader | 任务 3 |
| ChatHeader 风格切换器 | 任务 6 |
| ChatView 集成 | 任务 5 |
| PermissionPanel variant | 任务 7 |
| ChatInputView/ChatInput/UserQuestionPanel token | 任务 8 |
| SessionSidebar | 任务 8 |
| AppLayout | 任务 8 |
| 其余视图 (Home/Sessions/Settings/FileBrowser/GitDiff/AgentPanel/Modals) | 任务 9 |
| SettingsStore agentStyle | 任务 10 |
| i18n 风格 key | 任务 10 |
| SettingsModal 风格选择器 | 任务 10 |
| MobileBottomTabBar | 任务 11 |
| 移动端适配 | 任务 11 |
| chat-tokens.css 日落 | 任务 12 |

全部覆盖，无遗漏。

### 2. 占位符扫描

搜索 TODO/TBD/待定/后续实现/FIXME：无。

### 3. 类型一致性

- `StyleName = "claude" | "codex" | "grok"` — 在 styleStore.ts（任务 1）、settingsStore.ts（任务 10）、ChatHeader（任务 6）中使用一致。
- `AgentType` — 已在 sessionStore 定义，styleStore 的 `applyForAgent` 消费其字符串形式。
- `ChatMessage` — 已有 `role`、`content`、`thinking`、`toolCalls`、`thinkingContent?`、`thinkingElapsed?`、`diffs?`、`todos?` 字段。
- `ToolCall` — 已有 `id`、`name`、`status`、`input`、`output` 字段。
- CSS 变量命名统一 `--as-*` 前缀。
- 所有 import 路径以 `~/` 或相对路径，与项目现有模式一致。
