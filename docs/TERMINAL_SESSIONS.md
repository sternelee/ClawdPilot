# 终端会话管理功能

RiTerm 现在支持在终端标签页切换时自动保存和恢复会话上下文，提供无缝的多终端工作体验。

## 🎯 核心功能

### 自动会话保存
- **终端内容保存**：自动保存终端显示的文本内容
- **命令历史记录**：记录在终端中执行的所有命令
- **工作目录记忆**：保存当前的工作目录路径
- **滚动历史**：保存终端滚动条的历史内容

### 智能会话恢复
- **标签切换恢复**：切换到其他终端标签时自动恢复会话内容
- **连接恢复**：重新连接到终端时自动恢复之前的上下文
- **内容重建**：自动恢复终端显示内容和工作目录

### 视觉指示器
- **💾 图标**：在终端标签上显示保存的数据指示器
- **会话状态**：显示会话连接和保存状态
- **工具提示**：鼠标悬停显示会话详细信息

## 🚀 使用方法

### 基本使用
1. **创建多个终端**：点击 "➕ 新建" 创建多个终端标签
2. **正常使用**：在每个终端中正常工作，系统会自动保存
3. **切换标签**：点击不同的终端标签，会自动恢复对应的会话内容

### 会话状态查看
- **终端标签页**：查看 💾 图标了解哪些终端有保存的数据
- **工具提示**：将鼠标悬停在标签上查看详细信息
- **自动保存**：系统每3秒自动保存一次会话状态

### 开发测试
在开发环境中，可以在浏览器控制台运行测试：

```javascript
// 测试会话管理功能
testSessionManager()
```

## 📊 数据结构

### 会话数据存储
每个终端会话包含以下信息：

```typescript
interface TerminalSession {
  terminalId: string;           // 终端唯一标识符
  sessionId: string;            // 远程会话ID
  name?: string;                // 终端名称
  shellType: string;            // Shell类型 (bash, zsh, etc.)
  currentDir: string;           // 当前工作目录
  status: string;               // 终端状态
  createdAt: number;            // 创建时间
  lastActivity: number;         // 最后活动时间
  size: [number, number];       // 终端尺寸 [cols, rows]

  // 恢复数据
  terminalContent?: string;     // 终端内容缓存
  scrollback?: string[];        // 滚动历史
  commandHistory?: string[];    // 命令历史
  lastCommand?: string;         // 最后执行的命令
  workingDirectory?: string;    // 工作目录
  connectionState?: 'connected' | 'disconnected' | 'reconnecting';
}
```

### 存储位置
- **localStorage**：会话数据存储在浏览器本地存储中
- **自动清理**：定期清理过期会话数据
- **大小限制**：限制单个会话数据大小，避免存储空间问题

## ⚙️ 配置选项

### 会话设置
可以通过 `terminalSessionStore` 调整以下设置：

```javascript
// 获取会话管理器
const sessionManager = useTerminalSessions();

// 更新设置
sessionManager.updateSettings({
  saveContent: true,           // 是否保存终端内容
  maxScrollbackLines: 1000,    // 最大滚动历史行数
  autoSaveInterval: 5000,      // 自动保存间隔(毫秒)
});
```

### 终端配置
每个终端会话可以单独配置：

```javascript
// 创建终端时配置
const terminalSession = useTerminalSession(terminal, terminalId, {
  saveInterval: 3000,          // 保存间隔
  maxContentLength: 5000,      // 最大内容长度
});
```

## 🔄 工作流程

### 典型使用场景
1. **开发环境设置**：在不同终端中设置不同的开发环境
2. **多项目管理**：每个终端标签处理一个项目
3. **服务器管理**：同时连接到多个服务器进行管理
4. **学习实验**：在隔离的终端环境中进行实验

### 会话生命周期
1. **创建终端** → 自动创建会话记录
2. **执行命令** → 自动保存命令和内容
3. **切换标签** → 自动保存当前会话
4. **恢复会话** → 自动恢复保存的内容
5. **关闭连接** → 最终保存会话数据

## 🛠️ 技术实现

### 核心组件
- **TerminalSessionStore**：全局状态管理
- **useTerminalSession**：终端会话Hook
- **useSessionRecovery**：会话恢复Hook
- **RemoteSessionView**：集成到远程会话视图

### 自动保存机制
- **定时保存**：每隔3秒自动保存会话状态
- **事件触发**：终端内容变化时触发保存
- **切换保存**：切换终端标签时立即保存
- **退出保存**：组件卸载时最终保存

### 恢复机制
- **初始化恢复**：终端创建时尝试恢复数据
- **延迟恢复**：确保终端完全初始化后再恢复
- **内容重建**：分步骤恢复终端内容和历史
- **状态同步**：恢复后同步会话状态

## 🔧 故障排除

### 常见问题

**Q: 终端标签切换后内容丢失**
A: 检查浏览器localStorage是否被清理，确认自动保存功能正常工作

**Q: 会话恢复不完整**
A: 可能是网络问题或数据损坏，尝试重新连接终端

**Q: 存储空间不足**
A: 定期清理不需要的会话数据，调整保存间隔

### 调试方法
```javascript
// 查看当前会话数据
console.log(useTerminalSessions().sessions());

// 查看会话统计
console.log(useTerminalSessions().getSessionStats());

// 手动保存会话
useTerminalSessions().saveTerminalContent(terminalId, content);
```

## 🔒 隐私安全

- **本地存储**：所有数据仅存储在本地浏览器中
- **自动清理**：定期清理过期数据，保护隐私
- **敏感信息**：用户需注意不要在终端中输入敏感信息
- **数据控制**：用户完全控制会话数据的导出和删除