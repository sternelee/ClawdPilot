# 移动端终端界面优化

## 概述

参考 Sandbox.dev 移动端终端界面，优化了 RemoteSessionView 组件，提供更好的移动端终端使用体验。

## 界面布局

### 整体结构

```
┌─────────────────────────────┐
│  顶部导航栏                  │  ← 返回、创建、菜单
├─────────────────────────────┤
│  终端标签栏（水平滚动）      │  ← 快速切换终端
├─────────────────────────────┤
│                             │
│                             │
│     xterm 终端显示区域       │  ← 主要交互区域
│                             │
│                             │
├─────────────────────────────┤
│  快捷键按钮栏                │  ← Esc Tab ↑ ↓ Enter...
└─────────────────────────────┘
```

## 主要改进

### 1. **顶部导航栏简化**

**移动端**:
- ✅ 返回按钮
- ✅ 新建终端按钮（➕）
- ✅ 菜单按钮（☰）

**桌面端**:
- ✅ 返回按钮
- ✅ 刷新按钮
- ✅ 新建终端按钮
- ✅ 断开连接按钮

### 2. **水平滚动终端标签栏**（移动端）

```typescript
<div class="flex px-2 py-1 min-w-max overflow-x-auto scrollbar-hide">
  <For each={terminals()}>
    {(terminal) => (
      <button class={isActive ? "bg-primary" : "bg-base-200"}>
        <span class="status-dot" />
        <span>{terminal.name}</span>
      </button>
    )}
  </For>
</div>
```

**特性**:
- 🎨 活动标签高亮显示（primary 颜色）
- 🟢 状态指示器（运行/启动/停止）
- 📏 自动截断长名称（max-w-[120px]）
- 👆 平滑滚动，触摸友好

### 3. **全屏终端显示**

```typescript
<div class="absolute inset-0 bg-black flex flex-col">
  <div ref={terminalElement} class="flex-1 w-full h-full" />
</div>
```

**优化点**:
- 移除了移动端独立的标题栏
- 终端占据最大可用空间
- 统一桌面端和移动端渲染逻辑
- 自动 fit 终端大小

### 4. **底部快捷键栏**（移动端专属）

```typescript
const shortcuts = [
  { key: 'esc', label: 'Esc' },
  { key: 'tab', label: 'Tab' },
  { key: 'up', label: '↑' },
  { key: 'down', label: '↓' },
  { key: 'enter', label: 'Enter' },
  { key: 'ctrl-c', label: 'Ctrl-C' },
  { key: 'ctrl-t', label: 'Ctrl-T' },
];
```

**支持的快捷键**:
| 按键 | 功能 | 控制字符 |
|------|------|----------|
| Esc | 退出/取消 | `\x1b` |
| Tab | 自动补全 | `\t` |
| ↑ | 上箭头 | `\x1b[A` |
| ↓ | 下箭头 | `\x1b[B` |
| Enter | 执行命令 | `\r` |
| Ctrl-C | 中断程序 | `\x03` |
| Ctrl-T | 新建标签 | `\x14` |

**交互优化**:
- ✨ 按下动画效果（scale-95）
- 📱 触摸反馈（onTouchStart/End）
- 🎨 统一样式设计
- 📏 响应式布局（flex-1）

## 技术实现

### 快捷键发送函数

```typescript
const sendShortcut = (key: string) => {
  const keyMap: Record<string, string> = {
    'esc': '\x1b',
    'tab': '\t',
    'enter': '\r',
    'up': '\x1b[A',
    'down': '\x1b[B',
    'ctrl-c': '\x03',
    'ctrl-t': '\x14',
    // ... 更多快捷键
  };

  invoke("send_terminal_input_to_terminal", {
    sessionId: props.sessionId,
    terminalId: activeId,
    input: keyMap[key],
  });
};
```

### 移动端标签栏渲染

```typescript
<Show when={isMobile && terminals().length > 0}>
  <div class="overflow-x-auto scrollbar-hide">
    <div class="flex px-2 py-1 min-w-max">
      <For each={terminals()}>
        {(terminal) => (
          <button
            class={isActive ? "bg-primary text-primary-content" : "bg-base-200"}
            onClick={() => setActiveTerminalId(terminal.id)}
          >
            <span class="status-indicator" />
            <span>{terminal.name}</span>
          </button>
        )}
      </For>
    </div>
  </div>
</Show>
```

### CSS 优化

```css
/* 隐藏滚动条但保持功能 */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/* 平滑滚动 */
.overflow-x-auto {
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
}

/* 按钮触摸反馈 */
.shortcut-bar button:active {
  transform: scale(0.92);
}

/* 安全区域适配 */
.safe-area-bottom {
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 0.5rem);
}
```

## 使用场景

### 移动端操作流程

1. **打开终端**
   - 点击标签栏切换终端
   - 或点击➕创建新终端

2. **输入命令**
   - 使用虚拟键盘输入
   - 或使用底部快捷键

3. **常用操作**
   - Tab: 自动补全
   - ↑↓: 历史命令
   - Ctrl-C: 中断程序
   - Esc: 退出 vim/less 等

### 桌面端操作流程

1. **标签页管理**
   - 顶部标签页切换
   - Ctrl+1-9 快捷键
   - 鼠标悬停显示信息

2. **终端操作**
   - 使用物理键盘
   - 标准终端快捷键

## 响应式设计

### 移动端（< 768px）
- 水平滚动标签栏
- 底部快捷键栏
- 简化的顶部导航
- 全屏终端显示

### 桌面端（≥ 768px）
- 多标签页布局
- 完整工具栏
- 无快捷键栏（使用物理键盘）
- 标准终端界面

## 性能优化

### 渲染优化
```typescript
// 延迟 fit 确保容器已渲染
setTimeout(() => {
  session.fitAddon.fit();
}, 100);
```

### 触摸优化
```typescript
// 触摸反馈
onTouchStart={(e) => {
  e.currentTarget.classList.add('scale-95');
}}
onTouchEnd={(e) => {
  e.currentTarget.classList.remove('scale-95');
}}
```

### 滚动优化
```css
/* iOS 平滑滚动 */
-webkit-overflow-scrolling: touch;
scroll-behavior: smooth;
```

## 可访问性

- ✅ 触摸目标最小 44x44px
- ✅ 明确的视觉反馈
- ✅ 状态指示器
- ✅ 语义化 HTML
- ✅ 键盘导航支持

## 未来改进

### 计划功能
- [ ] 长按快捷键显示更多选项
- [ ] 自定义快捷键配置
- [ ] 手势支持（滑动切换标签）
- [ ] 快捷键学习模式
- [ ] 触觉反馈（震动）

### 扩展快捷键
- [ ] Ctrl-D (EOF)
- [ ] Ctrl-Z (暂停)
- [ ] Ctrl-L (清屏)
- [ ] 方向键（左右）
- [ ] Home/End

## 兼容性

| 平台 | 状态 | 备注 |
|------|------|------|
| iOS Safari | ✅ | 完全支持 |
| Android Chrome | ✅ | 完全支持 |
| 桌面浏览器 | ✅ | 标准界面 |
| Tauri Android | ✅ | 原生体验 |
| Tauri iOS | 🔄 | 开发中 |

## 测试建议

### 移动端测试
1. 创建多个终端
2. 测试标签栏滚动
3. 测试所有快捷键
4. 测试触摸反馈
5. 测试屏幕旋转

### 功能测试
- ✅ Esc 键退出 vim
- ✅ Tab 键自动补全
- ✅ 方向键历史命令
- ✅ Ctrl-C 中断程序
- ✅ Enter 执行命令

## 相关文档

- [移动端输入框优化](./MOBILE_INPUT_OPTIMIZATION.md)
- [移动端优化总览](./MOBILE_OPTIMIZATIONS.md)
- [设备检测实现](./DEVICE_DETECTION.md)
- [快捷键指南](./SHORTCUT_KEYS_GUIDE.md)

## 参考

- [Sandbox.dev](https://sandbox.dev) - UI 设计参考
- [Xterm.js](https://xtermjs.org/) - 终端模拟器
- [DaisyUI](https://daisyui.com/) - UI 组件库
