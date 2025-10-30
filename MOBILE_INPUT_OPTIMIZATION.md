# 移动端输入框优化

## 概述

针对移动端输入法遮挡问题，优化了所有输入框的交互体验，当输入框获得焦点时自动向上移动，避免被虚拟键盘遮挡。

## 设备检测机制

### Tauri OS 插件集成
使用 `@tauri-apps/plugin-os` 进行准确的平台检测：

```typescript
// 异步检测（推荐，首次初始化）
const capabilities = await getDeviceCapabilitiesAsync();

// 同步检测（使用缓存结果或 UA 回退）
const capabilities = getDeviceCapabilities();
```

**检测优先级**:
1. 🎯 **Tauri OS Plugin** - 在 Tauri 原生环境中使用（最准确）
2. 🌐 **User Agent** - 在 Web 浏览器中回退使用

**支持的平台**:
- ✅ Android (via Tauri)
- ✅ iOS (via Tauri)
- ✅ Windows (via Tauri)
- ✅ macOS (via Tauri)
- ✅ Linux (via Tauri)
- ✅ Web browsers (fallback)

## 优化内容

### 1. HomeView 主页输入框
**位置**: `src/components/HomeView.tsx`

**优化点**:
- ✅ 会话票据输入框（Session Ticket Input）
- ✅ 登录模态框中的用户名和密码输入框

**交互效果**:
- 输入框获得焦点时，整个页面内容向上移动（`justify-start pt-20`）
- Logo 和标题自动缩小（`scale-90`, `text-3xl`）
- 描述文字在移动端隐藏，节省空间
- 动画过渡流畅（`transition-all duration-300`）

### 2. RemoteSessionView 创建终端对话框
**位置**: `src/components/RemoteSessionView.tsx`

**优化点**:
- ✅ 创建终端时的名称输入框

**交互效果**:
- 对话框位置自动调整（从底部移动到顶部 `pt-12`）
- 标题自动缩小以节省空间
- 终端大小提示信息在输入时隐藏
- 保持桌面端原有体验

## 技术实现

### 核心机制

```typescript
// 1. 添加焦点状态追踪
const [inputFocused, setInputFocused] = createSignal(false);

// 2. 在输入框上绑定焦点事件
<input
  onFocus={() => setInputFocused(true)}
  onBlur={() => setInputFocused(false)}
/>

// 3. 使用 classList 动态调整样式
<div
  classList={{
    "justify-center": !inputFocused() || !isMobile,
    "justify-start pt-20": inputFocused() && isMobile
  }}
>
```

### 响应式设计

- **移动端检测**: 使用 `getDeviceCapabilities().isMobile` 判断设备类型
- **条件应用**: 优化仅在移动端生效（`inputFocused() && isMobile`）
- **桌面端体验**: 保持原有的居中布局和完整显示

## 优化效果

### 移动端（获得焦点前）
```
┌─────────────────┐
│                 │
│       ⚡         │
│     RiTerm      │
│  P2P 终端工具    │
│                 │
│  [输入票据...]   │
│                 │
│                 │
└─────────────────┘
```

### 移动端（获得焦点后）
```
┌─────────────────┐
│       ⚡         │ ← 缩小的 Logo
│    RiTerm       │ ← 缩小的标题
│  [输入票据...█]  │ ← 输入框
├─────────────────┤
│                 │
│   虚拟键盘区域   │ ← 不再遮挡输入框
│                 │
└─────────────────┘
```

## 动画细节

- **过渡时间**: 300ms（`duration-300`）
- **缓动函数**: CSS 默认 ease（平滑自然）
- **影响属性**: 
  - `justify-content` (布局)
  - `padding-top` (间距)
  - `transform: scale()` (缩放)
  - `font-size` (字体大小)
  - `margin-bottom` (间距)

## 统一的输入框样式

所有输入框添加了统一的字体大小：
```tsx
class="input input-bordered text-base"
```

这确保移动端输入时字体不会被自动缩放，提供更好的可读性。

## 兼容性

- ✅ iOS Safari
- ✅ Android Chrome
- ✅ 桌面浏览器（不受影响）
- ✅ Tauri 桌面应用（不受影响）
- ✅ Tauri Android 应用

## 测试建议

### 移动端测试
1. 打开应用主页
2. 点击会话票据输入框
3. 观察页面是否平滑上移
4. 输入内容，确认虚拟键盘不遮挡输入框
5. 失去焦点，确认页面恢复原状

### 登录模态框测试
1. 点击登录按钮（如果有）
2. 在用户名/密码框获得焦点
3. 确认模态框位置自动调整
4. 切换输入框，确认过渡流畅

### 创建终端测试
1. 在远程会话中点击"创建终端"
2. 在名称输入框获得焦点
3. 确认对话框向上移动
4. 输入名称后失去焦点
5. 确认对话框恢复原位

## 后续优化建议

1. **键盘高度检测**: 可以监听 `window.visualViewport` 获取准确的键盘高度
2. **自适应偏移**: 根据键盘高度动态计算上移距离
3. **焦点管理**: 添加自动聚焦和焦点循环功能
4. **手势支持**: 支持下滑关闭键盘
5. **输入验证**: 添加实时输入验证和友好提示

## 相关文档

- [移动端优化总览](./MOBILE_OPTIMIZATIONS.md)
- [移动端键盘测试](./MOBILE_KEYBOARD_TESTING.md)
- [快捷键指南](./SHORTCUT_KEYS_GUIDE.md)
