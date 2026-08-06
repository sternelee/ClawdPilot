# Task for worker

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
你正在实现任务 6：ChatHeader — 风格切换器 + 头部改造

## 任务描述

先读你的任务简报：/Users/sternelee/www/github/Irogen/.superpowers/sdd/task-6-brief.md

## 上下文

Irogen（SolidJS + TailwindCSS v4 + DaisyUI 5），前五个任务已完成。styleStore 从 `~/stores/styleStore` 导入，提供：
- `styleStore.currentStyle()` — 当前风格 "claude"|"codex"|"grok"
- `styleStore.manualOverride()` — 是否手动覆盖
- `styleStore.setManualStyle(s)` — 手动切换
- `styleStore.restoreAuto()` — 恢复自动映射

项目位置：/Users/sternelee/www/github/Irogen，分支：feat/agent-styles

## 你的工作

1. 修改 `src/components/chat/ChatHeader.tsx`，在现有 header 结构中加入风格切换器（下拉菜单，选项：Auto / Claude / Codex / Grok）。从 styleStore 引入。
2. 添加必要的 import：`FiChevronDown`（solid-icons/fi 已有）、`styleStore`、`StyleName` 类型
3. `pnpm tsc --noEmit`
4. Commit: `feat(style): add agent style switcher to ChatHeader`
5. 报告：/Users/sternelee/www/github/Irogen/.superpowers/sdd/task-6-report.md

简报中有完整的切换器代码模板，请尽量遵循。注意 ChatHeader 现有 250 行代码——在现有结构中找合适位置插入，不要破坏现有功能。

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