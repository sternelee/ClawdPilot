// 在浏览器控制台中运行此脚本来调试 xterm 问题

console.log("=== Xterm Debug Info ===");

// 1. 查找所有 xterm 实例
const xtermElements = document.querySelectorAll('.xterm');
console.log(`Found ${xtermElements.length} xterm instance(s)`);

xtermElements.forEach((el, index) => {
  console.log(`\n--- Xterm Instance ${index + 1} ---`);
  
  // 容器信息
  console.log("Container:", {
    width: el.clientWidth,
    height: el.clientHeight,
    scrollHeight: el.scrollHeight,
    offsetHeight: el.offsetHeight,
  });
  
  // Viewport 信息
  const viewport = el.querySelector('.xterm-viewport');
  if (viewport) {
    console.log("Viewport:", {
      width: viewport.clientWidth,
      height: viewport.clientHeight,
      scrollHeight: viewport.scrollHeight,
      scrollTop: viewport.scrollTop,
      computedStyle: window.getComputedStyle(viewport).position,
    });
  }
  
  // Screen 信息
  const screen = el.querySelector('.xterm-screen');
  if (screen) {
    console.log("Screen:", {
      width: screen.clientWidth,
      height: screen.clientHeight,
      scrollHeight: screen.scrollHeight,
    });
  }
  
  // Scroll area 信息
  const scrollArea = el.querySelector('.xterm-scroll-area');
  if (scrollArea) {
    console.log("Scroll Area:", {
      height: scrollArea.clientHeight,
      computedHeight: window.getComputedStyle(scrollArea).height,
    });
  }
  
  // Rows 信息
  const rows = el.querySelector('.xterm-rows');
  if (rows) {
    console.log("Rows:", {
      height: rows.clientHeight,
      childCount: rows.children.length,
    });
  }
  
  // Canvas 信息
  const canvas = el.querySelector('canvas');
  if (canvas) {
    console.log("Canvas:", {
      width: canvas.width,
      height: canvas.height,
      styleWidth: canvas.style.width,
      styleHeight: canvas.style.height,
    });
  }
});

// 2. 检查父容器
const terminalContainer = document.querySelector('.absolute.inset-0.bg-black');
if (terminalContainer) {
  console.log("\n--- Terminal Container ---");
  console.log({
    width: terminalContainer.clientWidth,
    height: terminalContainer.clientHeight,
    position: window.getComputedStyle(terminalContainer).position,
  });
}

// 3. 建议
console.log("\n=== Debugging Tips ===");
console.log("1. Viewport 应该有固定的 height (等于容器高度)");
console.log("2. Scroll area 不应该超过 viewport 的高度");
console.log("3. 确保调用了 terminal.fit() 来设置正确的行数");
console.log("4. 检查 CSS 中是否有冲突的样式");

// 4. 尝试修复
console.log("\n=== Try Auto Fix ===");
const viewport = document.querySelector('.xterm-viewport');
if (viewport) {
  console.log("Applying fixes to viewport...");
  viewport.style.position = 'absolute';
  viewport.style.top = '0';
  viewport.style.right = '0';
  viewport.style.bottom = '0';
  viewport.style.left = '0';
  viewport.style.overflowY = 'scroll';
  viewport.style.overflowX = 'hidden';
  console.log("✓ Viewport fixed");
}
