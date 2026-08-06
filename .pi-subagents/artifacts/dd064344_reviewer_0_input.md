# Task for reviewer

审查任务 4 实现：MessageRow（三种风格的消息行）

## 要求

读取简报：/Users/sternelee/www/github/Irogen/.superpowers/sdd/task-4-brief.md
读取报告：/Users/sternelee/www/github/Irogen/.superpowers/sdd/task-4-report.md
读取 Diff：/Users/sternelee/www/github/Irogen/.superpowers/sdd/review-5feb966..742a9ef.diff

全局约束：
- ChatMessage 有 role、content 字段
- 三种风格的完整分支（claude/codex/grok），user 消息和 assistant 消息都有
- 颜色用 DaisyUI 主题变量（hsl(var(--p))、hsl(var(--bc)) 等）
- 圆角/字号用 --as-* token
- Grok 风格用气泡 + 头像，Claude 用 ❯ 前缀纯文本

审查：规格合规性 + 代码质量。输出：✅/❌、优点、问题（关键/重要/次要 + file:line）、评估（通过/需要修复）

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