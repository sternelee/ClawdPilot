# Task for worker

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
你正在实现任务 8：SessionSidebar / AppLayout / ChatInput 等基础改造

## 任务描述

先读简报：/Users/sternelee/www/github/Irogen/.superpowers/sdd/task-8-brief.md

## 上下文

Irogen（SolidJS），前七个任务已完成。styleStore 已可用，CSS token `--as-*` 系列已在 agent-styles.css 定义。

项目位置：/Users/sternelee/www/github/Irogen，分支：feat/agent-styles

## 你的工作：对以下 5 个文件做 token 驱动改造

### 1. SessionSidebar.tsx
- 导入 styleStore
- 根 `<aside>` 或 `<nav>` 上添加 densityClass，按 currentStyle() 区分 gap/py

### 2. AppLayout.tsx
- 主容器的 gap/padding 改为 CSS 变量 `gap-[var(--as-section-gap,1rem)]`

### 3. ChatInputView.tsx
- 硬编码 rounded-lg → `rounded-[var(--as-radius,0.5rem)]`

### 4. UserQuestionPanel.tsx
- 同上，圆角改为 token

### 5. ChatInput.tsx (src/components/ui/)
- 同上，圆角改为 token

改动原则：**最小化**，只把硬编码的间距/圆角值换成 CSS 变量引用，不改结构。

验证：`pnpm tsc --noEmit`

Commit: `feat(style): apply token-driven styling to sidebar, layout, input components`

报告：/Users/sternelee/www/github/Irogen/.superpowers/sdd/task-8-report.md

## Acceptance Contract
Acceptance level: checked
Completion is not accepted from prose alone. End with a structured acceptance report.

Criteria:
- criterion-1: Implement the requested change without widening scope

Required evidence: changed-files, tests-added, commands-run, residual-risks, no-staged-files

Finish with a fenced JSON block tagged `acceptance-report` in this shape:
Use empty arrays when no items apply; array fields contain strings unless object entries are shown.
`criteriaSatisfied[].status` must be exactly one of: satisfied, not-satisfied, not-applicable.
`commandsRun[].result` must be exactly one of: passed, failed, not-run.
`manualNotes` and `notes` are optional strings; an empty string means no note and does not satisfy `manual-notes` evidence.
```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "specific proof"
    }
  ],
  "changedFiles": [
    "src/file.ts"
  ],
  "testsAddedOrUpdated": [
    "test/file.test.ts"
  ],
  "commandsRun": [
    {
      "command": "command",
      "result": "passed",
      "summary": "short result"
    }
  ],
  "validationOutput": [
    "validation output or concise summary"
  ],
  "residualRisks": [
    "none"
  ],
  "noStagedFiles": true,
  "diffSummary": "short description of the diff",
  "reviewFindings": [
    "blocker: file.ts:12 - issue found, or no blockers"
  ],
  "manualNotes": "anything else the parent should know"
}
```