# Parallel Agents 工作台设计

## 概述

对齐 Zed 的 Parallel Agents 方案，为 Irogen 添加多线程并行工作台能力。

## 核心功能

### 1. Threads Sidebar (线程侧边栏)

**位置**：左侧边栏内，与导航菜单并列

**功能**：
- 按项目分组显示所有线程
- 显示线程状态（运行中/已停止）
- 支持停止、归档、创建新线程
- 快速切换活跃线程

**交互**：
- 点击线程切换活跃 session
- 悬停显示操作按钮（停止、归档）
- 每个项目分组可展开/折叠

### 2. Agent Panel (Agent 面板)

**位置**：主内容区，多 tab 并排显示

**功能**：
- 每个 session 一个 tab
- 支持多 session 并行运行
- Tab 显示 agent 类型和状态
- 可关闭单个 session

**布局**：
- 新布局：Threads Sidebar 在左，Agent Panel 在中，Project/Git Panel 在右
- Tab 横向排列，可拖拽重排

### 3. Per-Thread 文件夹隔离

**功能**：
- 每个线程可设置独立的工作目录
- 支持跨项目线程（一个线程读写多个仓库）
- 隔离模式可选

### 4. 多 Agent 类型支持

**功能**：
- 每个线程可选择不同 agent (Claude, Codex, Gemini, OpenCode, Cline, Pi, Qwen)
- 支持混用本地和远程 agent

## 技术实现

### 前端改动

1. **ThreadsSidebar** 组件增强
   - 添加线程分组视图
   - 添加状态指示器和快捷操作

2. **AgentPanel** 新组件
   - 多 tab 布局
   - Tab 管理（创建、关闭、重排）

3. **Layout 调整**
   - 新默认布局：Threads | Agent Panel | Tools
   - 可自定义面板位置

### Store 改动

1. **sessionStore** 增强
   - 多 session 并行管理
   - Tab 顺序持久化

2. **navigationStore** 新增视图
   - "workspace" -> 多 session 并行视图

## 实现计划

1. Threads Sidebar 增强（分组视图、状态、快捷操作）
2. AgentPanel 多 tab 布局
3. 新布局系统（可拖拽调整）
4. 跨项目线程支持
5. Agent 混用支持

## 优先级

P0: Threads Sidebar + AgentPanel 多 tab
P1: 新布局系统
P2: 跨项目线程
P3: Agent 混用