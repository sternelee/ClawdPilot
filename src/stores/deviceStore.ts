import { createSignal } from "solid-js";
import { type as osType } from "@tauri-apps/plugin-os";

export interface DeviceCapabilities {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  supportsTouch: boolean;
  supportsHaptic: boolean;
  supportsFullscreen: boolean;
  supportsOrientation: boolean;
  screenSize: "xs" | "sm" | "md" | "lg" | "xl";
  hasPhysicalKeyboard: boolean;
  platform: "android" | "ios" | "windows" | "macos" | "linux" | "web";
}

function detectPlatform(): DeviceCapabilities["platform"] {
  try {
    const os = osType();
    if (os === "android" || os === "ios" || os === "windows" || os === "macos" || os === "linux") {
      return os;
    }
  } catch (error) {
    // Tauri not available, detect from user agent
    const ua = navigator.userAgent.toLowerCase();
    if (/android/i.test(ua)) return "android";
    if (/iphone|ipad|ipod/i.test(ua)) return "ios";
    if (/windows/i.test(ua)) return "windows";
    if (/mac/i.test(ua)) return "macos";
    if (/linux/i.test(ua)) return "linux";
  }
  return "web";
}

function getScreenSize(): DeviceCapabilities["screenSize"] {
  const width = window.screen.width;
  if (width < 475) return "xs";
  if (width < 640) return "sm";
  if (width < 768) return "md";
  if (width < 1024) return "lg";
  return "xl";
}

function detectCapabilities(): DeviceCapabilities {
  const platform = detectPlatform();
  const screenWidth = window.screen.width;
  const isMobile = platform === "android" || platform === "ios" || screenWidth <= 768;
  const isTablet = isMobile && screenWidth >= 768;
  const isDesktop = !isMobile;

  return {
    isMobile,
    isTablet,
    isDesktop,
    supportsTouch: "ontouchstart" in window || navigator.maxTouchPoints > 0,
    supportsHaptic: "vibrate" in navigator,
    supportsFullscreen: "requestFullscreen" in document.documentElement,
    supportsOrientation: "orientation" in window,
    screenSize: getScreenSize(),
    hasPhysicalKeyboard: !isMobile || isTablet,
    platform,
  };
}

// 全局设备信息状态
const [deviceCapabilities, setDeviceCapabilities] = createSignal<DeviceCapabilities>(
  detectCapabilities()
);

// 导出只读的 getter
export function getDeviceCapabilities(): DeviceCapabilities {
  return deviceCapabilities();
}

// 初始化函数（在应用启动时调用）
export function initializeDeviceDetection(): void {
  const capabilities = detectCapabilities();
  setDeviceCapabilities(capabilities);

  console.log("[DeviceStore] Initialized:", {
    platform: capabilities.platform,
    isMobile: capabilities.isMobile,
    isTablet: capabilities.isTablet,
    screenSize: capabilities.screenSize,
  });

  // 添加 CSS 类到 document
  document.documentElement.classList.toggle("mobile", capabilities.isMobile);
  document.documentElement.classList.toggle("tablet", capabilities.isTablet);
  document.documentElement.classList.toggle("desktop", capabilities.isDesktop);
  document.documentElement.classList.toggle("touch", capabilities.supportsTouch);
  document.documentElement.classList.add(`screen-${capabilities.screenSize}`);
  document.documentElement.classList.add(`platform-${capabilities.platform}`);
}

// 便捷的布尔值导出
export const isMobile = () => deviceCapabilities().isMobile;
export const isTablet = () => deviceCapabilities().isTablet;
export const isDesktop = () => deviceCapabilities().isDesktop;
export const getPlatform = () => deviceCapabilities().platform;
