# 跨项目线程设计

## 概述

支持一个 session 同时操作多个项目路径，以主项目 + 附加项目模式工作。

## 数据模型

### sessionStore 改动

```typescript
interface AgentSessionMetadata {
  // ... 现有字段 ...
  projectPath: string;              // 主项目
  additionalProjectPaths: string[]; // 附加项目列表
}
```

### Rust 后端改动

```rust
// local_start_agent 参数新增
additional_project_paths: Option<Vec<String>>
```

## UI 交互

### 位置

ChatView 顶部工具栏 或 ThreadItem 下方

### 操作

1. 点击「+ 添加项目」按钮
2. 弹出路径输入框（支持手动输入或目录选择）
3. 添加后显示为可移除的 tag
4. 点击 tag 的 × 移除

### 样式

```
[ Claude ] + 添加项目
[附加: /path/to/add1 ] ×
[附加: /path/to/add2 ] ×
```

## Claude Code 启动方式

### 环境变量传递

```bash
CLAUDE_PROJECT_PATH=/path/to/main
CLAUDE_ADDITIONAL_PATHS=/path/add1,/path/add2
```

### 或通过 extra_args

```bash
--project /path/to/main
--additional-path /path/add1
--additional-path /path/add2
```

## 实现步骤

1. **sessionStore** 新增 `additionalProjectPaths` 字段
2. **sessionStore** 新增 `addProjectPath()`, `removeProjectPath()` 方法
3. **UI 组件** 添加项目选择器（路径输入 + tag 显示）
4. **Rust 后端** `local_start_agent` 处理附加路径
5. **启动逻辑** 构建 CLI 参数时包含附加项目

## Agent 支持

- **P0**：Claude Code（原生支持多项目）
- **P1**：其他 agent（按需扩展）