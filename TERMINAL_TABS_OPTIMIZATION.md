# 桌面端终端标签栏优化

## 概述

优化桌面端的终端标签栏，隐藏滚动条并在标签过多时提供下拉菜单访问所有终端。

## 改进内容

### 1. 隐藏滚动条

```tsx
<div class="flex-1 overflow-x-auto scrollbar-hide">
  {/* 标签内容 */}
</div>
```

**效果**:
- ✅ 保留水平滚动功能
- ✅ 隐藏难看的滚动条
- ✅ 更简洁的视觉效果

### 2. 下拉菜单按钮

**触发条件**: 当终端数量 > 5 时显示

```tsx
<Show when={terminals().length > 5}>
  <button class="btn btn-ghost btn-sm">
    <ChevronDownIcon />
  </button>
</Show>
```

**位置**: 标签栏右侧，带边框分隔

### 3. 下拉列表

```tsx
<div class="absolute right-0 top-full mt-1 w-64 max-h-96 overflow-y-auto">
  <For each={terminals()}>
    {(terminal) => (
      <button class={isActive ? "bg-primary" : "hover:bg-base-200"}>
        <StatusDot />
        <Index />
        <Name />
      </button>
    )}
  </For>
</div>
```

**特性**:
- 📋 显示所有终端
- 🎯 活动终端高亮
- 🟢 状态指示器
- 🔢 索引编号
- 📏 名称自动截断
- 🎨 悬停效果

## 界面布局

### 标签栏少于 5 个终端

```
┌─────────────────────────────────────┐
│ [Tab1] [Tab2] [Tab3] [Tab4]         │
└─────────────────────────────────────┘
```

### 标签栏超过 5 个终端

```
┌─────────────────────────────────┬───┐
│ [Tab1] [Tab2] [Tab3] [Tab4] ... │ ▼ │
└─────────────────────────────────┴───┘
                                    │
                    ┌───────────────▼────┐
                    │ 🟢 1 Terminal 1    │
                    │ 🟢 2 Terminal 2    │
                    │ 🔵 3 Terminal 3 ✓  │ ← 活动终端
                    │ 🟢 4 Terminal 4    │
                    │ 🟡 5 Terminal 5    │
                    │ 🟢 6 Terminal 6    │
                    └────────────────────┘
```

## 技术实现

### 状态管理

```typescript
// 下拉菜单状态
const [showDesktopTerminalDropdown, setShowDesktopTerminalDropdown] = 
  createSignal(false);

// 标签容器引用
let tabsContainerRef: HTMLDivElement | undefined;
```

### 点击外部关闭

```tsx
<Show when={showDesktopTerminalDropdown()}>
  <div 
    class="fixed inset-0 z-40" 
    onClick={() => setShowDesktopTerminalDropdown(false)}
  />
</Show>
```

### CSS 类

```css
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```

## 用户交互

### 标签栏滚动

1. **鼠标滚轮**: 在标签栏上滚动切换标签
2. **拖拽滚动**: 可以左右拖动标签栏
3. **键盘**: Ctrl+1-9 快速切换

### 下拉菜单

1. **打开**: 点击右侧 ▼ 按钮
2. **选择**: 点击任意终端切换
3. **关闭**: 
   - 点击终端（自动关闭）
   - 点击外部区域
   - 按 ESC 键

## 响应式设计

### 桌面端（≥ 768px）
- ✅ 显示标签栏
- ✅ 隐藏滚动条
- ✅ 超过 5 个显示下拉按钮

### 移动端（< 768px）
- ✅ 水平滚动标签
- ✅ 显示滚动条（触摸友好）
- ❌ 不显示下拉按钮（已有菜单）

## 样式细节

### 标签按钮

```css
/* 活动标签 */
.active-tab {
  background: base-100;
  border: 1px solid gray-300;
  border-bottom: 0;
  box-shadow: sm;
}

/* 非活动标签 */
.inactive-tab {
  background: base-300/50;
  hover: bg-base-300;
}
```

### 下拉列表项

```css
/* 活动项 */
.active-item {
  background: primary;
  color: primary-content;
}

/* 悬停效果 */
.hover-item {
  background: base-200;
}
```

### 分隔线

```css
.divider {
  border-left: 1px solid base-300;
}
```

## 可访问性

- ✅ 键盘导航（Ctrl+数字）
- ✅ 鼠标滚轮支持
- ✅ 触摸友好（移动端）
- ✅ 明确的视觉反馈
- ✅ Tooltip 提示信息

## 性能优化

### 按需渲染

```tsx
// 只在超过 5 个时才渲染下拉菜单
<Show when={terminals().length > 5}>
```

### 事件委托

```tsx
// 使用单个事件监听器
<div onClick={(e) => e.stopPropagation()}>
```

### 虚拟滚动（未来）

对于超多终端（>50），可以考虑虚拟滚动：

```typescript
// 只渲染可见的项目
const visibleTerminals = () => {
  const start = Math.floor(scrollTop / itemHeight);
  const end = start + visibleCount;
  return terminals().slice(start, end);
};
```

## 对比

### 优化前

```
问题:
❌ 滚动条突兀
❌ 标签过多难以查找
❌ 视觉混乱
```

### 优化后

```
优点:
✅ 界面简洁
✅ 快速访问所有终端
✅ 活动标签一目了然
✅ 支持大量终端
```

## 使用场景

### 场景 1: 少量终端（1-5个）
- 直接在标签栏点击
- 使用 Ctrl+数字快捷键
- 鼠标滚轮切换

### 场景 2: 大量终端（>5个）
- 使用下拉菜单查看全部
- 通过名称快速定位
- 状态指示器一目了然

### 场景 3: 查找特定终端
1. 点击下拉按钮
2. 浏览列表（带状态和索引）
3. 点击目标终端

## 未来改进

### 搜索功能
```tsx
<input 
  type="text"
  placeholder="搜索终端..."
  onChange={(e) => filterTerminals(e.target.value)}
/>
```

### 分组功能
```tsx
<TerminalGroup name="开发环境">
  <Terminal name="API Server" />
  <Terminal name="Frontend" />
</TerminalGroup>
```

### 拖拽排序
```tsx
<DraggableTab 
  onDragEnd={(oldIndex, newIndex) => reorderTerminals(oldIndex, newIndex)}
/>
```

### 固定标签
```tsx
<Tab pinned={true} />  // 始终显示，不受滚动影响
```

## 测试建议

### 功能测试
- [ ] 滚动条已隐藏
- [ ] 横向滚动正常工作
- [ ] 超过5个终端时显示下拉按钮
- [ ] 下拉菜单正确显示所有终端
- [ ] 点击终端正确切换
- [ ] 点击外部关闭菜单
- [ ] 活动终端高亮显示

### 交互测试
- [ ] 鼠标滚轮滚动标签栏
- [ ] 点击标签切换终端
- [ ] 键盘 Ctrl+数字切换
- [ ] 下拉菜单悬停效果
- [ ] 状态指示器正确显示

### 边界测试
- [ ] 0 个终端
- [ ] 1 个终端
- [ ] 5 个终端（临界值）
- [ ] 6 个终端（显示下拉）
- [ ] 50+ 个终端（性能）

## 相关文件

- `src/components/RemoteSessionView.tsx` - 主组件
- `src/index.css` - scrollbar-hide 样式
- `MOBILE_TERMINAL_UI.md` - 移动端优化

## 总结

通过隐藏滚动条和添加下拉菜单，桌面端终端标签栏现在：
- ✨ 更简洁美观
- 🚀 更易于使用
- 📊 支持更多终端
- 🎯 快速访问和切换

完美平衡了简洁性和功能性！
