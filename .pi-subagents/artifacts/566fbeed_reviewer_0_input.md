# Task for reviewer

你正在审查任务 3 的实现：聊天核心组件 — WelcomeHeader / ThinkingRow / ToolCallRow / DiffBlock / TodoListBlock

## 要求的内容

读取任务简报：/Users/sternelee/www/github/Irogen/.superpowers/sdd/task-3-brief.md

全局约束：
- 颜色全部继承 DaisyUI 主题（hsl(var(--p))、hsl(var(--b2))、hsl(var(--bc)) 等）
- 圆角/字号/过渡速度使用 --as-* CSS token
- WelcomeHeader 需实现三个完整变体（claude/codex/grok），简报只给了 claude
- ThinkingRow 需要用 aria-live="polite" 和 role="status"
- ToolCallRow 需要用 `<details>` 语义
- DiffBlock 需要 +/- tinted 行样式
- TodoListBlock 需要用 `<ul>` + role="list"
- ToolCall 类型来自 `~/stores/chatStore`（字段：id, name, status, input, output）

## 实现者声称构建了什么

读取报告：/Users/sternelee/www/github/Irogen/.superpowers/sdd/task-3-report.md

## Diff

Diff 文件：/Users/sternelee/www/github/Irogen/.superpowers/sdd/review-cb4bf7e..5c7f341.diff

一次性读取 diff 文件。不要重跑 git 命令。审查是只读的。

## 第一部分：规格合规性
- 缺失/多余/理解偏差
- WelcomeHeader codex/grok 变体是否合理实现

## 第二部分：代码质量
- 是否正确消费 --as-* token
- 可访问性语义是否正确

## 输出格式
### 规格合规性（✅/❌/⚠️）
### 优点
### 问题（关键/重要/次要，带 file:line）
### 评估（通过 | 需要修复）

## Acceptance Contract
Acceptance level: attested
Completion is not accepted from prose alone. End with a structured acceptance report.

Criteria:
- criterion-1: Return concrete findings with file paths and severity when applicable

Required evidence: review-findings, residual-risks

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