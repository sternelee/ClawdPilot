## Review

### ✅ 通过

### 优点

- **`MessageBubble` 彻底移除** — import、`VirtualMessageRowProps` 接口、`VirtualMessageRow` 组件、所有 6 个旧 handler（`handleQuoteMessage`、`handleResendMessage`、`handleSyncTodoList`、`handleApplyEditReview`、`handleTerminalAction`、`handleOpenFileLocation`）均已干净删除，无残留引用
- **新组件集成正确** — `MessageRow`（接收 `message: ChatMessage`）、`ThinkingRow`（接收 `thinking`/`isStreaming`/`elapsed`）、`ToolCallRow`（接收 `tool: ToolCall`）的 props 类型全部与调用点匹配
- **`ChatMessage` 新字段类型正确**：`thinkingContent?: string`、`thinkingElapsed?: number`、`diffs?: Hunks[]`、`todos?: TodoItem[]`，全部可选，不破坏现有消息
- **`For each` 改为按 `role` 条件渲染组件链**，`message.thinking` 门控避免用户消息误渲染 `ThinkingRow`
- **事件流完整**：`sessionEventRouter.subscribe` → `handleSessionEvent` → `pushSystemCard`（TODO/Follow/EditReview/Terminal）链路未触动，Tauri `invoke("send_agent_message")` 未触动
- **TypeScript 零新错误** — `pnpm tsc --noEmit` 仅报告 2 个与本次无关的预存错误（`src/api/tauriApi.ts` 缺少生成的 `tauri-bindings`）
- **净 -104 行**，代码密度提升

### 问题

| 严重程度 | 位置 | 问题 |
|----------|------|------|
| 重要 | `src/components/ChatView.tsx` 消息 JSX | `DiffBlock` 和 `TodoListBlock` 虽然有组件文件且 `ChatMessage` 已有对应字段（`diffs`/`todos`），但 JSX 中尚未接入渲染。报告确认「待后续任务添加」，但简报明确要求 `<DiffBlock>` 和 `<TodoListBlock>` 出现在消息循环中。**这是一个作用域缺口**——如果简报是权威来源，则这属于遗漏。 |
| 次要 | `src/components/ChatView.tsx` | `MessageListView.tsx` 在简报中被标记为「修改」目标文件，但实际未改动（diff 仅含 ChatView.tsx 和 chatStore.ts）。报告未提及该文件。无功能影响，但与简报不一致。 |
| 次要 | 消息循环 | 移除的 6 个 handler 承载了旧 `MessageBubble` 的 hover 操作按钮功能（引用、重发、文件浏览器、终端操作、编辑审查）。这些 UX 功能当前丢失，报告标记为「后续迭代重新挂接」。 |
| 次要 | `src/components/chat/`（9 个文件） | 报告指出存在未暂存的制表符→空格格式化修改，来自 pi-lens 自动格式化器，尚未提交。 |

### 评估

**通过（需要修复）** — 核心技术指标全部达成：MessageBubble + VirtualMessageRow 完全移除，新组件正确集成，类型检查通过，事件流无破坏。唯一实质性缺口是 `DiffBlock` / `TodoListBlock` 的 JSX 渲染尚未接入（组件和类型定义已就位）。若简报是强制规范，则需要在合并前补充这两个渲染；若报告中的「待后续任务添加」已获批准，则当前状态即可接受。