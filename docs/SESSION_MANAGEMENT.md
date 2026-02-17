# 终端会话管理功能

ClawdChat 现在支持全局状态管理来保存多个终端的会话记录，方便切换时能恢复上下文。
...

- `clawdchat-terminal-sessions`：会话数据
- `clawdchat-recently-used-sessions`：最近使用的会话列表

### 数据结构

每个会话包含以下信息：

```typescript
interface TerminalSession {
  id: string; // 会话唯一ID
  sessionId: string; // 远程会话ID
  name?: string; // 会话名称
  terminalId: string; // 终端ID
  shellType: string; // Shell类型
  currentDir: string; // 当前目录
  status: string; // 会话状态
  createdAt: number; // 创建时间
  lastActivity: number; // 最后活动时间
  size: [number, number]; // 终端尺寸
  processId?: number; // 进程ID

  // 恢复相关数据
  terminalContent?: string; // 终端内容缓存
  scrollback?: string[]; // 滚动历史
  workingDirectory?: string; // 工作目录
  environmentVars?: Record<string, string>; // 环境变量
  commandHistory?: string[]; // 命令历史
  lastCommand?: string; // 最后执行的命令
  connectionState?: "connected" | "disconnected" | "reconnecting"; // 连接状态
}
```

## 性能考虑

- 会话数据有大小限制，避免存储过多内容
- 滚动历史会限制最大行数
- 自动保存间隔可调节，平衡性能和数据安全性
- 定期清理过期会话释放存储空间

## 故障排除

### 会话数据丢失

- 检查浏览器localStorage是否被清理
- 确认自动保存功能已开启
- 检查存储空间是否充足

### 恢复失败

- 确认会话数据格式正确
- 检查终端是否支持内容恢复
- 尝试手动导入备份的会话数据

### 性能问题

- 减少最大滚动历史行数
- 增加自动保存间隔
- 定期清理不需要的会话

## 隐私和安全

- 会话数据仅存储在本地浏览器中
- 不会发送到任何服务器
- 敏感命令和内容可能会被保存，请谨慎使用
- 导出的JSON文件包含完整的会话数据，请妥善保管
