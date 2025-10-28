import { createEffect, onCleanup } from 'solid-js';
import { useTerminalSessions } from '../stores/terminalSessionStore';
import { Terminal } from '@xterm/xterm';

export interface TerminalSessionOptions {
  saveInterval?: number; // 保存间隔(毫秒)
  maxContentLength?: number; // 最大内容长度
}

export function useTerminalSession(
  terminal: Terminal | undefined,
  terminalId: () => string | undefined,
  options: TerminalSessionOptions = {}
) {
  const {
    saveInterval = 5000, // 5秒保存一次
    maxContentLength = 5000, // 最大5KB内容
  } = options;

  const terminalSessions = useTerminalSessions();

  let saveTimer: NodeJS.Timeout | undefined;
  let contentBuffer: string[] = [];
  let isCapturing = false;

  // 开始捕获终端输出
  const startCapture = () => {
    if (!terminal || isCapturing) return;

    isCapturing = true;
    console.log(`[TerminalSession] Starting capture for terminal ${terminalId()}`);

    // 重写write方法来捕获输出
    const originalWrite = terminal.write.bind(terminal);
    terminal.write = (data: string, callback?: () => void) => {
      // 调用原始方法
      const result = originalWrite(data, callback);

      // 捕获输出
      if (data && typeof data === 'string') {
        contentBuffer.push(data);

        // 限制缓冲区大小
        if (contentBuffer.length > 100) {
          contentBuffer = contentBuffer.slice(-50);
        }
      }

      return result;
    };
  };

  // 停止捕获终端输出
  const stopCapture = () => {
    if (!terminal || !isCapturing) return;

    isCapturing = false;
    console.log(`[TerminalSession] Stopping capture for terminal ${terminalId()}`);
  };

  // 保存当前会话状态
  const saveSessionState = () => {
    const currentTerminalId = terminalId();
    if (!currentTerminalId || !terminal) return;

    try {
      // 获取终端内容
      const buffer = terminal.buffer.active;
      const lines = [];

      // 获取当前可见内容
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) {
          const lineText = line.translateToString(true);
          if (lineText.trim()) {
            lines.push(lineText);
          }
        }
      }

      // 合并缓冲区和可见内容
      const allContent = [...contentBuffer, ...lines];
      const content = allContent.join('\n');

      // 限制内容长度
      const limitedContent = content.length > maxContentLength
        ? content.slice(-maxContentLength)
        : content;

      // 保存到store
      terminalSessions.saveTerminalContent(currentTerminalId, limitedContent, contentBuffer);

      console.log(`[TerminalSession] Saved session state for terminal ${currentTerminalId}`, {
        contentLength: limitedContent.length,
        bufferLength: contentBuffer.length,
      });

    } catch (error) {
      console.error(`[TerminalSession] Failed to save session state:`, error);
    }
  };

  // 恢复会话状态
  const restoreSessionState = async () => {
    const currentTerminalId = terminalId();
    if (!currentTerminalId || !terminal) return;

    const session = terminalSessions.getSession(currentTerminalId);
    if (!session || !session.terminalContent) {
      console.log(`[TerminalSession] No session data to restore for terminal ${currentTerminalId}`);
      return;
    }

    try {
      console.log(`[TerminalSession] Restoring session state for terminal ${currentTerminalId}`);

      // 延迟执行，确保终端已经完全初始化
      setTimeout(() => {
        if (terminal && !terminal._disposed) {
          // 清空终端
          terminal.clear();

          // 恢复终端内容
          terminal.write(session.terminalContent!);

          // 恢复滚动历史
          if (session.scrollback && session.scrollback.length > 0) {
            session.scrollback.forEach(line => {
              if (line && line.trim()) {
                terminal.write(line + '\r\n');
              }
            });
          }

          console.log(`[TerminalSession] Session restored successfully for terminal ${currentTerminalId}`);
        }
      }, 100);

    } catch (error) {
      console.error(`[TerminalSession] Failed to restore session state:`, error);
    }
  };

  // 保存命令
  const saveCommand = (command: string) => {
    const currentTerminalId = terminalId();
    if (!currentTerminalId || !command.trim()) return;

    terminalSessions.saveLastCommand(currentTerminalId, command.trim());

    // 更新命令历史
    const session = terminalSessions.getSession(currentTerminalId);
    if (session?.commandHistory) {
      const newHistory = [...session.commandHistory];
      if (!newHistory.includes(command.trim())) {
        newHistory.push(command.trim());
        terminalSessions.saveCommandHistory(currentTerminalId, newHistory);
      }
    }
  };

  // 保存工作目录（通过解析输出）
  const updateWorkingDirectory = (output: string) => {
    const currentTerminalId = terminalId();
    if (!currentTerminalId) return;

    // 尝试从命令提示符中提取工作目录
    // 匹配常见的命令提示符格式
    const promptMatches = [
      /user@[^:]+:([^$#]+)[\$#]\s*$/, // bash格式: user@hostname:path$
      /^(.+?)[>]\s*$/, // Windows格式: C:\path>
      /^([^:]+):[^$#]+[$#]\s*$/, // 简化格式: path$
    ];

    for (const regex of promptMatches) {
      const match = output.match(regex);
      if (match && match[1]) {
        const directory = match[1].trim();
        if (directory && directory !== session?.currentDir) {
          terminalSessions.saveWorkingDirectory(currentTerminalId, directory);
          break;
        }
      }
    }
  };

  // 开始自动保存
  const startAutoSave = () => {
    if (saveTimer) {
      clearInterval(saveTimer);
    }

    saveTimer = setInterval(() => {
      saveSessionState();
    }, saveInterval);
  };

  // 停止自动保存
  const stopAutoSave = () => {
    if (saveTimer) {
      clearInterval(saveTimer);
      saveTimer = undefined;
    }
  };

  // 监听终端变化
  createEffect(() => {
    if (terminal) {
      startCapture();
      startAutoSave();

      // 尝试恢复会话
      restoreSessionState();
    } else {
      stopCapture();
      stopAutoSave();
    }
  });

  // 监听终端ID变化
  createEffect(() => {
    const currentTerminalId = terminalId();
    if (currentTerminalId && terminal) {
      // 切换到新终端时尝试恢复会话
      restoreSessionState();
    }
  });

  // 组件卸载时清理
  onCleanup(() => {
    stopCapture();
    stopAutoSave();
    // 最后保存一次
    saveSessionState();
  });

  return {
    // 方法
    saveSessionState,
    restoreSessionState,
    saveCommand,
    updateWorkingDirectory,
    manualSave: saveSessionState,

    // 状态
    isCapturing: () => isCapturing,
    bufferSize: () => contentBuffer.length,
  };
}