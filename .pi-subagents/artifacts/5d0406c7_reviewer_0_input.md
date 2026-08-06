# Task for reviewer

审查任务 5 实现：ChatView 改造 — 集成新的消息组件

## 要求

读取简报：/Users/sternelee/www/github/Irogen/.superpowers/sdd/task-5-brief.md
读取报告：/Users/sternelee/www/github/Irogen/.superpowers/sdd/task-5-report.md
读取 Diff：/Users/sternelee/www/github/Irogen/.superpowers/sdd/review-742a9ef..b119702.diff

全局约束：
- ChatView 必须用 MessageRow 替代 MessageBubble
- ChatMessage 接口新增字段：thinkingContent?、thinkingElapsed?、diffs?、todos?
- 不能破坏现有事件流（Tauri invoke、ACP 事件路由）
- 颜色用 DaisyUI 主题变量

审查重点：
- MessageBubble import 已移除，VirtualMessageRow 定义已移除
- 新 For each body 使用 MessageRow + ThinkingRow + ToolCallRow
- ChatMessage 新字段类型正确
- 无损坏的 import

输出：✅/❌、优点、问题（关键/重要/次要 + file:line）、评估（通过/需要修复）

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