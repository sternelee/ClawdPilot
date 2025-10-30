# 设备检测实现

## 概述

RiTerm 使用全局状态管理设备信息，在应用启动时通过 Tauri OS 插件进行准确的平台检测。

## 架构设计

### 全局状态管理

使用 SolidJS 的 `createSignal` 创建全局设备状态：

```typescript
// src/stores/deviceStore.ts
const [deviceCapabilities, setDeviceCapabilities] = createSignal<DeviceCapabilities>(
  detectCapabilities()
);
```

**优势**:
- ✅ **简单直接**: 同步调用，无需 async/await
- ✅ **性能优化**: 启动时检测一次，全局复用
- ✅ **响应式**: 基于 SolidJS Signal，自动追踪依赖
- ✅ **类型安全**: 完整的 TypeScript 类型支持

## 快速使用

### 1. 在组件中使用

```typescript
import { getDeviceCapabilities, isMobile, isDesktop } from "../stores/deviceStore";

export function MyComponent() {
  // 方式 1: 获取完整能力对象
  const device = getDeviceCapabilities();
  
  // 方式 2: 使用便捷函数（响应式）
  return (
    <div>
      <Show when={isMobile()}>
        <MobileView />
      </Show>
      <Show when={isDesktop()}>
        <DesktopView />
      </Show>
    </div>
  );
}
```

### 2. 条件样式

```typescript
import { isMobile } from "../stores/deviceStore";

<div
  classList={{
    "mobile-layout": isMobile(),
    "desktop-layout": !isMobile()
  }}
>
```

## 初始化流程

### 启动顺序

在 `src/main.tsx` 中：

```typescript
// 1. 初始化设备检测（同步，立即完成）
initializeDeviceDetection();

// 2. 初始化移动端工具
initializeMobileUtils({ integrateViewportManager: true });

// 3. 其他初始化...
```

### 检测流程

```
应用启动
   ↓
initializeDeviceDetection()
   ↓
detectPlatform() → Tauri OS Plugin / User Agent
   ↓
detectCapabilities() → 检测所有能力
   ↓
setDeviceCapabilities() → 设置全局状态
   ↓
添加 CSS 类到 document.documentElement
   ↓
完成（可在任何组件中使用）
```

## API 参考

### 核心函数

#### `initializeDeviceDetection()`
在应用启动时调用一次，初始化设备检测。

```typescript
initializeDeviceDetection();
// Console: [DeviceStore] Initialized: { platform: 'android', isMobile: true, ... }
```

#### `getDeviceCapabilities()`
获取完整的设备能力对象（同步）。

```typescript
const capabilities = getDeviceCapabilities();
// {
//   isMobile: true,
//   isTablet: false,
//   isDesktop: false,
//   platform: "android",
//   screenSize: "sm",
//   ...
// }
```

### 便捷函数（响应式）

```typescript
isMobile()    // () => boolean - 是否移动端
isTablet()    // () => boolean - 是否平板
isDesktop()   // () => boolean - 是否桌面端
getPlatform() // () => Platform - 平台类型
```

## 平台检测

### Tauri OS 插件（优先）

```typescript
import { type as osType } from "@tauri-apps/plugin-os";

const platform = osType(); // "android" | "ios" | "windows" | "macos" | "linux"
```

### User Agent 回退

当 Tauri 不可用时（Web 环境）自动回退：

```typescript
const ua = navigator.userAgent.toLowerCase();
if (/android/i.test(ua)) return "android";
if (/iphone|ipad/i.test(ua)) return "ios";
// ...
```

## 设备能力接口

```typescript
interface DeviceCapabilities {
  // 设备类型
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  
  // 平台
  platform: "android" | "ios" | "windows" | "macos" | "linux" | "web";
  
  // 硬件能力
  supportsTouch: boolean;
  supportsHaptic: boolean;
  supportsFullscreen: boolean;
  supportsOrientation: boolean;
  
  // 屏幕
  screenSize: "xs" | "sm" | "md" | "lg" | "xl";
  hasPhysicalKeyboard: boolean;
}
```

### 屏幕尺寸分类

| 类别 | 宽度 | 典型设备 |
|------|------|---------|
| xs | < 475px | 小屏手机 |
| sm | 475-640px | 标准手机 |
| md | 640-768px | 大屏手机 |
| lg | 768-1024px | 平板 |
| xl | > 1024px | 桌面 |

## CSS 类自动添加

初始化时自动添加以下 CSS 类到 `<html>`：

```html
<!-- 设备类型 -->
<html class="mobile">        <!-- 或 tablet、desktop -->

<!-- 硬件能力 -->
<html class="touch">

<!-- 屏幕尺寸 -->
<html class="screen-sm">     <!-- xs、sm、md、lg、xl -->

<!-- 平台 -->
<html class="platform-android">  <!-- android、ios、windows、macos、linux、web -->
```

可在 CSS 中使用：

```css
/* 移动端样式 */
.mobile .my-component {
  padding: 0.5rem;
}

/* 桌面端样式 */
.desktop .my-component {
  padding: 1rem;
}

/* Android 特定 */
.platform-android .button {
  /* Android Material Design 风格 */
}

/* iOS 特定 */
.platform-ios .button {
  /* iOS Human Interface 风格 */
}
```

## 使用示例

### 响应式组件

```typescript
import { isMobile, isDesktop } from "../stores/deviceStore";

export function ResponsiveNav() {
  return (
    <nav>
      <Show when={isMobile()}>
        <MobileMenu />
      </Show>
      
      <Show when={isDesktop()}>
        <DesktopMenu />
      </Show>
    </nav>
  );
}
```

### 平台特定逻辑

```typescript
import { getPlatform } from "../stores/deviceStore";

export function handleBackButton() {
  const platform = getPlatform();
  
  if (platform === "android") {
    // Android 返回键处理
    registerBackButton();
  } else if (platform === "ios") {
    // iOS 手势处理
    enableSwipeBack();
  }
}
```

### 条件渲染列表

```typescript
import { getDeviceCapabilities } from "../stores/deviceStore";

export function FeatureList() {
  const device = getDeviceCapabilities();
  
  const features = () => [
    { name: "触摸支持", available: device.supportsTouch },
    { name: "震动反馈", available: device.supportsHaptic },
    { name: "全屏模式", available: device.supportsFullscreen },
  ];
  
  return (
    <For each={features()}>
      {(feature) => (
        <div class={feature.available ? "text-success" : "text-muted"}>
          {feature.name}: {feature.available ? "✓" : "✗"}
        </div>
      )}
    </For>
  );
}
```

## 平台支持

| 平台 | 检测方式 | 准确度 |
|------|---------|--------|
| Android (Tauri) | OS Plugin | ⭐⭐⭐⭐⭐ |
| iOS (Tauri) | OS Plugin | ⭐⭐⭐⭐⭐ |
| Windows | OS Plugin | ⭐⭐⭐⭐⭐ |
| macOS | OS Plugin | ⭐⭐⭐⭐⭐ |
| Linux | OS Plugin | ⭐⭐⭐⭐⭐ |
| Web | User Agent | ⭐⭐⭐⭐ |

## 最佳实践

### ✅ 推荐

```typescript
// 1. 使用响应式便捷函数
<Show when={isMobile()}>
  <MobileView />
</Show>

// 2. 缓存检测结果（组件内）
const device = getDeviceCapabilities();
if (device.isMobile && device.supportsTouch) { ... }

// 3. 使用 CSS 类
/* 在 CSS 文件中 */
.mobile .container { padding: 0.5rem; }
```

### ❌ 避免

```typescript
// 1. 不要重复调用
// ❌ Bad
if (getDeviceCapabilities().isMobile) { ... }
if (getDeviceCapabilities().isTablet) { ... }

// ✅ Good
const device = getDeviceCapabilities();
if (device.isMobile) { ... }
if (device.isTablet) { ... }

// 2. 不要在 initializeDeviceDetection() 前使用
// ❌ Bad - main.tsx 外层
const device = getDeviceCapabilities(); // 可能不准确

// ✅ Good - 在组件内使用
export function MyComponent() {
  const device = getDeviceCapabilities(); // 已初始化
}
```

## 调试

### 查看检测结果

打开浏览器控制台或 VConsole：

```
[DeviceStore] Initialized: {
  platform: 'android',
  isMobile: true,
  isTablet: false,
  screenSize: 'sm'
}
```

### 检查 CSS 类

```javascript
// 在控制台执行
console.log(document.documentElement.className);
// "mobile touch screen-sm platform-android has-safe-area mobile-optimized"
```

## 常见问题

### Q: 为什么不用异步检测？

A: 设备信息在启动时就确定了，同步检测更简单直接，避免了异步状态管理的复杂性。

### Q: 可以动态更新设备信息吗？

A: 通常不需要。设备类型在应用运行期间不会改变。如需响应屏幕旋转等事件，应该监听相关事件而不是重新检测设备。

### Q: Web 版本准确吗？

A: Web 版本使用 User Agent 检测，准确度约 95%。在 Tauri 环境中使用 OS 插件，准确度 100%。

### Q: 如何测试不同平台？

A: 
- **Tauri**: 直接在目标平台构建和运行
- **Web**: 使用浏览器的设备模拟器或修改 User Agent

## 相关文档

- [移动端输入框优化](./MOBILE_INPUT_OPTIMIZATION.md)
- [移动端优化总览](./MOBILE_OPTIMIZATIONS.md)
- [Tauri OS Plugin](https://v2.tauri.app/plugin/os/)
