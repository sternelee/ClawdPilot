Now I have a complete picture. Let me compile the full review.

---

## Review

### 优点

1. **CSS token 层设计优秀** — `agent-styles.css` 三套 token 正交于 DaisyUI 颜色主题，`[data-style="claude|codex|grok"]` 作用域清晰。组件消费 `var(--as-*)` 带合理回退值，风格切换即时生效无闪烁。

2. **styleStore 实现稳健** — `createRoot` 单例、`manualOverride`/`deriveStyle` 逻辑清晰，`applyDataStyle` 直接操作 `<html data-style>`，组件只需 `styleStore.currentStyle()` 即可响应。

3. **MessageRow 三种 variant 还原度高** — Claude 的 `>` 前缀纯文本行、Codex 的标签+卡片、Grok 的气泡+头像，三种风格视觉差异明显且正确。

4. **子组件语义正确** — `ThinkingRow` 使用 `aria-live="polite"` + `role="status"`、`ToolCallRow` 使用原生 `<details>`/`<summary>`、`TodoListBlock` 使用语义 `<ul>`。可访问性基础保留。

5. **ToolCall 类型对齐** — `ToolCallRow` 消费 `toolName`、`status`、`output`，与 `chatStore.ts` 的 `ToolCall` 接口完全一致。

6. **chat-tokens.css 日落干净** — `index.css` 导入已替换为 `agent-styles.css`，全仓库无 `chat-tokens` 残余引用。

7. **其余视图 token 适配彻底** — HomeView、SessionsView、SettingsView、FileBrowserView、GitDiffView、AgentPanel、HistorySelectionModal、TcpForwardingModal、MobileBottomTabBar、ToastContainer、WorkspaceShell 全面替换为 CSS 变量（`rounded-[var(--as-radius)]`、`p-[var(--as-section-gap)]`、`text-[var(--as-font-size-sm)]` 等）。

8. **TSC 无新增错误** — 仅存在预存在的 Tauri 生成绑定缺失（`src/generated/tauri-bindings` 未生成），与本次变更无关。

9. **i18n 双语言完整** — `en` + `zh-CN` 字典均新增 `style.*` 5 个 key。

---

### 问题

#### Critical

1. **`styleStore.ts:52-61` — auto-mapping 从未触发**
   `applyForAgent(agentType)` 唯一调用点是 `App.tsx:54`：`styleStore.applyForAgent()`（无参数）。会话切换、Codex 启动时从未传递 `agentType`，因此 `deriveStyle` 永远返回 `defaultStyle`（claude）。规格要求 `ClaudeCode → claude`、`Codex → codex` 自动映射完全未生效。
   **修复**：在 ChatView 或 sessionStore 的会话激活路径添加 `styleStore.applyForAgent(session.agentType)`。

2. **`styleStore.ts:56-59` — `setDefaultStyle` 空实现**
   ```ts
   setDefaultStyle: (s: StyleName) => {
     setDefaultStyle(s);
     if (!manualOverride()) {
       // re-evaluate current from agentType of active session
     }
   },
   ```
   注释占位但从未调用 `updateStyle()`。虽然当前 `setDefaultStyle` 无调用方（SettingsModal 走 `settingsStore.setAgentStyle` 路径），但暴露了空方法体作为公共 API，属于缺陷。
   **修复**：补充 `if (!manualOverride()) { updateStyle(/* 需要当前 agentType */); }` 或标记为 TODO。

#### Important

3. **`src/components/chat/WelcomeHeader.tsx` — 死代码**
   WelcomeHeader 在 `chat/index.ts` 导出但全仓库无消费。ChatView.tsx 空态渲染 `ChatEmptyState`（来自 `MessageListView.tsx`），不感知风格。规格要求三种风格的欢迎屏全部未接入。
   **修复**：在 ChatView.tsx 空态路径调用 `<WelcomeHeader agentType={...} model={...} cwd={...} />` 替代或补充 `ChatEmptyState`。

4. **`src/components/chat/MessageListView.tsx:101-149` — `ChatEmptyState` 不感知风格**
   `ChatEmptyState` 固定使用 `border border-base-content/10`、`text-xl sm:text-2xl` 等硬编码值，三种风格下空态外观完全一致。
   **修复**：将 `ChatEmptyState` 改为 token 驱动（`rounded-[var(--as-radius)]` 等），或用 `WelcomeHeader` 替代。

5. **`src/components/ui/Card.tsx:16` — 始终 bordered，忽略 `--as-card-border`  token**
   `isBordered = () => props.bordered ?? true`，Claude 风格设置 `--as-card-border: 0` 期望无边框，但 Card 组件从不读取该 token。Card 目前很少使用（视图直接用 DaisyUI `card-bordered`），影响小但语义不完整。
   **修复**：添加 `readStyleVar("card-border")` 判断，或通过 `--as-card-border` 驱动 `border` 样式。

6. **`src/components/chat/ChatInputView.tsx` + `src/components/chat/UserQuestionPanel.tsx` — 零变更，未 token 化**
   计划任务 8 明确要求这两个文件 token 驱动。diff 无任何变更，仍使用硬编码 `rounded-xl`、`text-sm` 等。
   **修复**：按任务 8/9 模式适配 token。

7. **`src/components/chat/ThinkingRow.tsx:33` — 流式状态切换不响应**
   `onMount` 中检查 `props.isStreaming` 启动 `verbInterval`，但 `isStreaming` prop 变化时不会重启/停止 interval。如果 ThinkingRow 挂载时 `isStreaming=true`，流式结束后 `isStreaming→false` 时 interval 仍运行（spinner 持续旋转），直到父级 `message.thinking` 变为 false 才卸载。
   **修复**：用 `createEffect` 替代 `onMount` 中的 boolean 检查，追踪 `() => props.isStreaming`。

#### Minor

8. **`src/components/chat/ChatHeader.tsx:53-58` — `styleAppearanceLabel` 缺少 default 返回**
   ```ts
   function styleAppearanceLabel(s: StyleName): string {
     switch (s) {
       case "claude": return "Claude";
       case "codex": return "Codex";
       case "grok": return "Grok";
     }
   }
   ```
   三个 case 已穷举 `StyleName` 联合类型，但严格模式下 TS 会报 `not all code paths return a value`。运行时若类型被强制转换也可返回 `undefined`。
   **修复**：添加 `default: return s;`。

9. **`src/components/SessionSidebar.tsx` — `SessionItem` 不感知风格密度**
   `densityClass` 仅应用到 `<aside>` 根元素，`SessionItem` 内部仍硬编码 `rounded-lg px-3 py-2.5`。不同风格下会话列表项间距/圆角无变化。
   **修复**：`SessionItem` 使用 CSS 变量 `rounded-[var(--as-radius)]`、`py-[var(--as-density-padding)]`。

10. **`src/components/chat/PermissionPanel.tsx:32-34` — Claude variant 缺少 radiogroup 语义**
    规格要求 Claude 风格内联审批行使用 `role="radiogroup"` + 方向键导航。当前实现 Claude container 使用 `role="group"`，内部 `PermissionMessage` 组件不做 radio 行为。

---

### 建议

1. **考虑 chat/index.ts 统一作为入口点** — 当前 `MessageRow`、`ThinkingRow` 等通过 barrel 导出，但 ChatView.tsx 直接 import 各文件而非走 barrel。建议统一用法。

2. **为 ChatView 空态路径添加 `WelcomeHeader` 回退** — 当无消息且非 loading 时，先尝试 WelcomeHeader（三种风格变体），而不是仅 ChatEmptyState。

3. **`ToolCallRow` 可增加 input 展示** — 当前仅展示 output，计划中 `ToolCall` 类型无 input 字段，但未来可能有用。

4. **移动端 `.message-bubble` 选择器有效性存疑** — `agent-styles.css:90` 定义了 `[data-style="grok"] .message-bubble { max-width: 90%; }`，但 Grok 的 MessageRow 气泡使用 `max-w-[80%]` 直接写在 Tailwind 类中，CSS 选择器 `.message-bubble` 不匹配任何元素（MessageRow 没有 `message-bubble` class）。

---

### 评估

**不能合并，需修复后再合。**

理由：Critical 问题 1（auto-mapping 未接线）直接违背规格的核心功能——agent 类型自动映射风格。用户启动 Codex 会话后风格不会自动切换到 codex view，等同于规格承诺功能缺失。Critical 问题 2（setDefaultStyle 空体）暴露未完成的 API。修复这两个问题 + 至少接入 WelcomeHeader（Important 3）后可合。其余 Important/Minor 项可作为后续迭代。