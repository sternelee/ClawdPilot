Task 6 complete.

**实现内容：** 在 ChatHeader 右侧工具栏（Files/Git 按钮之后）加入 agent 风格切换下拉菜单，选项 Auto / Claude / Codex / Grok。默认显示 "Auto"（跟随 agent 自动映射），手动选择后调用 `styleStore.setManualStyle(s)` 覆盖，Auto 调用 `styleStore.restoreAuto()` 恢复。用 SolidJS `<For>` 渲染（无 React key），`classList` 高亮当前选中项。

**验证：** `pnpm tsc --noEmit` 仅 2 个预存错误（tauriApi.ts missing tauri-bindings），无新增错误。

**Commit：** `4e533fa` feat(style): add agent style switcher to ChatHeader (50 insertions, 1 deletion)