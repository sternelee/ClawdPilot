# Irogen Agent 界面三风格系统设计

日期：2026-01-27
状态：已确认（用户分节批准）

## 背景

用户要求重构 Irogen 的 chat UI/UX，参考 [brainless](https://brainless.swerdlow.dev)（shadcn/ui 注册表，重建 Claude Code / Codex / Grok 界面为可访问的 React 组件）。brainless 为 React + Radix 实现，与 Irogen 的 SolidJS + Kobalte 不兼容，故采用**自主设计**：借鉴 brainless 的设计理念与语义模型，用 SolidJS 生态原生实现。

## 决策汇总

| # | 决策 | 结论 |
| --- | --- | --- |
| 1 | 框架策略 | 自主设计（SolidJS + Kobalte 原生实现，借鉴 brainless 理念） |
| 2 | 范围 | 全部：欢迎屏、消息列表、输入区、权限面板、会话侧边栏、会话结构 |
| 3 | 切换机制 | 全局风格切换（自动映射为默认，手动切换覆盖） |
| 4 | 风格 vs 主题 | 正交：风格管组件形态与密度，DaisyUI 主题管颜色 |
| 5 | agent 映射 | ClaudeCode→Claude、Codex→Codex、其余→默认（defaultStyle，初始 claude） |
| 6 | 还原度 | 高还原：Claude=极简终端、Codex=结构化分步面板、Grok=圆润现代气泡 |
| 7 | 移动端 | 三种风格都做移动端适配（窄屏布局、触控友好） |
| 8 | 应用范围 | 全应用（Home、Sessions、Settings、FileBrowser、GitDiff 等所有视图） |
| 9 | 项目拆分 | 不拆分：一份规格、一份实现计划 |
| 10 | 技术架构 | 方案 3 混合：CSS token 层 + 关键组件 variant |

## 架构：风格引擎

### styleStore（新）

```ts
interface StyleState {
  style: "claude" | "codex" | "grok";        // 当前生效风格
  defaultStyle: "claude";                      // 未映射 agent 的默认
  manualOverride: boolean;                     // 用户是否手动切换（覆盖自动映射）
}
```

- 根节点（`<html>` 或 `<body>`）挂 `data-style` 属性
- 自动映射：会话活跃时，按其 `agentType` 决定风格；`ClaudeCode → claude`、`Codex → codex`、其余 → `defaultStyle`
- 全局切换器：修改 `defaultStyle` 并置 `manualOverride = true`；再次点击"自动"恢复自动映射
- 会话内不提供覆盖（范围外，仅预留接口）

### 风格 token（CSS 变量）

三种风格各自定义 token，挂载在 `[data-style="claude|codex|grok"]` 作用域：

| Token | claude | codex | grok |
| --- | --- | --- | --- |
| `--chat-density` | compact | normal | spacious |
| `--chat-radius` | 最小 | 中 | 大 |
| `--chat-font-mono` | 是 | 部分 | 否 |
| `--chat-msg-bubble` | 无（纯文本行） | 无（分步卡） | 有（气泡） |
| `--chat-msg-align` | 左 | 左 | 左 |
| `--chat-thinking-row` | 单行状态 | 折叠卡片 | 气泡内状态 |
| `--chat-tool-call-row` | 行内 details | 卡片 details | 气泡内 details |
| `--chat-avatar` | 前缀符号（❯） | 标签 | 头像 |
| `--chat-prefix` | ❯ | 无 | 无 |

颜色全部来自 DaisyUI 主题（`--base-content`、`--p`、`--b1` 等），风格层不定义颜色，保持正交。

### 共享原子组件（token 驱动）

`src/components/ui/` 新增/改造，全部消费 token、不硬编码：

- `styleToken.ts` — 读取 CSS 变量 token 的工具
- `Button`、`Input`、`Card`、`ListItem`、`Badge` — 基础组件
- `Select`、`Switch`、`Dialog` — Kobalte 封装

## 聊天视图（子项目 B）

### 消息列表

数据模型已有：`ChatMessage`（role、thinking、toolCalls）、`ToolCall`（id、name、status、input/output）、ACP 事件流。

**MessageRow**（按风格 variant）：

- 用户消息：claude=❯ 前缀 + 纯文本 / codex=标签行 + 文本 / grok=右侧气泡 + 头像
- 助手消息：claude=纯文本行 / codex=分步卡 / grok=左侧气泡
- 系统/状态行：内联小字（三种风格统一）

**子组件（brainless 语义建模，保留可访问性语义）：**

| 组件 | 语义 | 说明 |
| --- | --- | --- |
| `ThinkingRow` | `aria-live="polite"` | 思考中：旋转图标 + 动词轮换 + 已用时间；结束后折叠"已思考 Xs" |
| `ToolCallRow` | `<details>` | ⏺/⏸ 图标 + 名称 + 状态；`<summary>` 展开输入/输出 |
| `DiffBlock` | 结构化表格 | +/- 行、行号、tinted 背景（复用 `@pierre/diffs` 解析） |
| `TodoListBlock` | `<ul>` 语义列表 | agent todo 列表，状态标签 + 划线完成 |
| `PermissionInline` | 内联审批 | AlwaysAsk 下的内联确认 |

**流式渲染**：保持原生滚动（不使用虚拟化）；ThinkingRow→ToolCallRow 过渡用 `solid-transition-group` 轻量过渡。

### 欢迎屏 / 头部

- `WelcomeHeader`（对应 brainless claude-header）：logo + tips + 模型/cwd 行，`fieldset/legend` 语义；按风格变体
- `ChatHeader`（改造现有 250 行）：风格切换器入口 + agent/模型/cwd + 右侧面板开关（Files/Git/Permissions）

### 输入区

现有 `ChatInputView.tsx` + `ui/ChatInput.tsx`：

- 多行输入 + Enter 发送 + Shift+Enter 换行（保留）
- 模型/cwd 指示行（claude 风格）→ 其他风格按 token 变化
- 斜杠命令补全（已有 SlashCommandItem）保留
- 发送禁用态 + 停止按钮（打断流式）

## 权限面板

现有权限模式：AlwaysAsk、AcceptEdits、Plan、AutoApprove。ACP 权限消息分两类：PermissionRequest（内联询问）、Plan 完成确认。

**按风格变体：**

- claude：内联审批行（⏎ 接受 / esc 拒绝 / 方向键选选项）— `role="radiogroup"` + 方向键导航
- codex：结构化卡片，请求详情 + 选项按钮组
- grok：居中对话框卡片 + 大按钮

**统一行为**：权限历史（PermissionHistory）保留；超时/拒绝逻辑保留；`aria-live` 播报请求到达。

## 会话侧边栏

当前 `AppLayout` 共享侧边栏（logo、导航项、会话列表、底部连接状态）：

- claude：极简列表、高密度、细分割线
- codex：分组结构（分组标签 + 会话项）
- grok：圆角卡片式列表、更大间距

侧边栏随根节点 `data-style` 自动变换（与其余视图一致）。

## 其余视图（子项目 C）

Home（devices/proxies/hosts）、Sessions、Settings、FileBrowser、GitDiff、AgentPanel、MobileBottomTabBar、对话框（NewSession/HistorySelection/TcpForwarding/Settings）：

- 全部改为消费 token 的组件
- 三种风格的差异收敛：主要在密度、圆角、卡片化程度
- 对话框统一 Kobalte `Dialog` + 风格化 header/footer
- 移动端：`MobileBottomTabBar` 跟随 token；窄屏统一抽屉式布局

## 实现顺序（单计划内）

1. `styleStore` + 根节点 `data-style` + agent 映射
2. token 定义（三套 CSS 变量）
3. 共享原子组件
4. 聊天：欢迎屏/消息行/思考/工具/diff/todo/权限/输入
5. 侧边栏 + 其余视图适配
6. 移动端适配 + 打磨

## 错误处理与回退

- 风格 token 缺失回退 claude 默认值（`@theme` 定义默认层）
- 未知 agentType → defaultStyle
- Tauri invoke、事件路由、权限流程逻辑不动，仅 UI 层改造

## 约束

- i18n：en/zh-CN（`i18nStore`），新文案两个语言都加
- 可访问性：保留 `<details>`、`radiogroup`、`aria-live` 等语义，不把组件拍平为纯文本
- 验证：`pnpm tsc` + 现有 lint；`cargo` 侧不动
