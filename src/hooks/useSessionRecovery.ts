import { createSignal, createEffect, onCleanup, onMount } from 'solid-js';
import { useTerminalSessions, TerminalSession } from '../stores/terminalSessionStore';
import { Terminal } from '@xterm/xterm';

export interface SessionRecoveryOptions {
  autoRestore?: boolean; // 是否自动恢复会话
  saveInterval?: number; // 保存间隔(毫秒)
  maxContentLength?: number; // 最大内容长度
  restoreContent?: boolean; // 是否恢复终端内容
}

export interface SessionState {
  sessionId: string;
  terminalId: string;
  content: string;
  scrollback: string[];
  cursorPosition: { x: number; y: number };
  workingDirectory: string;
  commandHistory: string[];
  lastCommand: string;
}

export function useSessionRecovery(
  terminal: Terminal | undefined,
  sessionId: () => string | undefined,
  options: SessionRecoveryOptions = {}
) {
  const {
    autoRestore = true,
    saveInterval = 3000, // 3秒保存一次
    maxContentLength = 10000, // 最大10KB内容
    restoreContent = true,
  } = options;

  const terminalSessions = useTerminalSessions();
  const [isRecovering, setIsRecovering] = createSignal(false);
  const [lastSaveTime, setLastSaveTime] = createSignal(0);
  const [contentBuffer, setContentBuffer] = createSignal<string[]>([]);

  let saveTimer: NodeJS.Timeout | undefined;
  let isCapturing = false;

  // 开始捕获终端输出
  const startCapture = () => {
    if (!terminal || isCapturing) return;

    isCapturing = true;
    console.log('[SessionRecovery] Starting terminal capture');

    // 监听终端数据输出
    terminal.onData((data) => {
      // 这里可能需要通过其他方式获取终端输出
      // 因为Terminal.js不直接提供输出监听
    });

    // 通过重写write方法来捕获输出
    const originalWrite = terminal.write;
    terminal.write = (data: string) => {
      // 调用原始方法
      const result = originalWrite.call(terminal, data);

      // 捕获输出
      if (data && typeof data === 'string') {
        setContentBuffer(prev => {
          const newBuffer = [...prev, data];
          // 限制缓冲区大小
          if (newBuffer.length > 100) {
            return newBuffer.slice(-50);
          }
          return newBuffer;
        });
      }

      return result;
    };
  };

  // 停止捕获终端输出
  const stopCapture = () => {
    if (!terminal || !isCapturing) return;

    isCapturing = false;
    console.log('[SessionRecovery] Stopping terminal capture');

    // 恢复原始write方法
    // 注意：这里需要保存原始方法的引用
  };

  // 保存当前会话状态
  const saveSessionState = async () => {
    const currentSessionId = sessionId();
    if (!currentSessionId || !terminal) return;

    try {
      // 获取终端内容
      const buffer = terminal.buffer.active;
      const lines = [];

      // 获取当前可见内容
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) {
          lines.push(line.translateToString(true));
        }
      }

      const content = lines.join('\n');
      const limitedContent = content.length > maxContentLength
        ? content.slice(-maxContentLength)
        : content;

      // 获取光标位置
      const cursorPosition = {
        x: buffer.cursorX,
        y: buffer.cursorY,
      };

      // 获取滚动历史
      const scrollback = contentBuffer();

      // 保存到store
      terminalSessions.saveTerminalContent(currentSessionId, limitedContent, scrollback);

      // 更新最后保存时间
      setLastSaveTime(Date.now());

      console.log('[SessionRecovery] Session state saved', {
        sessionId: currentSessionId,
        contentLength: limitedContent.length,
        scrollbackLength: scrollback.length,
        cursorPosition,
      });

    } catch (error) {
      console.error('[SessionRecovery] Failed to save session state:', error);
    }
  };

  // 恢复会话状态
  const restoreSessionState = async (session: TerminalSession): Promise<boolean> => {
    if (!terminal || !restoreContent) {
      console.log('[SessionRecovery] Content restore disabled or terminal not available');
      return false;
    }

    setIsRecovering(true);
    console.log('[SessionRecovery] Starting session restore', { sessionId: session.sessionId });

    try {
      // 清空终端
      terminal.clear();

      // 恢复终端内容
      if (session.terminalContent) {
        terminal.write(session.terminalContent);
      }

      // 恢复滚动历史（如果终端支持）
      if (session.scrollback && session.scrollback.length > 0) {
        // 这里可能需要根据终端的具体实现来恢复滚动历史
        session.scrollback.forEach(line => {
          if (line) {
            terminal.write(line + '\r\n');
          }
        });
      }

      // 恢复命令历史到某个输入系统（如果有）
      if (session.commandHistory && session.commandHistory.length > 0) {
        console.log('[SessionRecovery] Command history available:', session.commandHistory.length);
      }

      // 恢复工作目录（通过发送cd命令）
      if (session.workingDirectory && session.workingDirectory !== session.currentDir) {
        const cdCommand = `cd "${session.workingDirectory}"\r\n`;
        terminal.write(cdCommand);
      }

      // 如果有最后执行的命令，可以显示它
      if (session.lastCommand) {
        console.log('[SessionRecovery] Last command available:', session.lastCommand);
      }

      console.log('[SessionRecovery] Session restore completed');
      return true;

    } catch (error) {
      console.error('[SessionRecovery] Failed to restore session state:', error);
      return false;
    } finally {
      setIsRecovering(false);
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

  // 手动保存命令
  const saveCommand = (command: string) => {
    const currentSessionId = sessionId();
    if (!currentSessionId) return;

    terminalSessions.saveLastCommand(currentSessionId, command);

    // 更新命令历史
    const session = terminalSessions.getSession(currentSessionId);
    if (session?.commandHistory) {
      const newHistory = [...session.commandHistory];
      if (!newHistory.includes(command)) {
        newHistory.push(command);
        terminalSessions.saveCommandHistory(currentSessionId, newHistory);
      }
    }
  };

  // 更新工作目录
  const updateWorkingDirectory = (directory: string) => {
    const currentSessionId = sessionId();
    if (!currentSessionId) return;

    terminalSessions.saveWorkingDirectory(currentSessionId, directory);
  };

  // 导出会话数据
  const exportSessionData = () => {
    const currentSessionId = sessionId();
    if (!currentSessionId) return null;

    const session = terminalSessions.getSession(currentSessionId);
    return session ? {
      content: session.terminalContent || '',
      scrollback: session.scrollback || [],
      commandHistory: session.commandHistory || [],
      workingDirectory: session.workingDirectory || session.currentDir,
      lastCommand: session.lastCommand || '',
      timestamp: session.lastActivity,
    } : null;
  };

  // 导入会话数据
  const importSessionData = async (data: SessionState) => {
    const currentSessionId = sessionId();
    if (!currentSessionId || !terminal) return false;

    try {
      setIsRecovering(true);
      terminal.clear();

      // 恢复内容
      if (data.content) {
        terminal.write(data.content);
      }

      // 恢复滚动历史
      if (data.scrollback) {
        data.scrollback.forEach(line => {
          if (line) {
            terminal.write(line + '\r\n');
          }
        });
      }

      // 保存到store
      terminalSessions.saveTerminalContent(currentSessionId, data.content, data.scrollback);
      terminalSessions.saveCommandHistory(currentSessionId, data.commandHistory);
      terminalSessions.saveWorkingDirectory(currentSessionId, data.workingDirectory);
      terminalSessions.saveLastCommand(currentSessionId, data.lastCommand);

      console.log('[SessionRecovery] Session data imported successfully');
      return true;

    } catch (error) {
      console.error('[SessionRecovery] Failed to import session data:', error);
      return false;
    } finally {
      setIsRecovering(false);
    }
  };

  // 清理会话数据
  const clearSessionData = () => {
    const currentSessionId = sessionId();
    if (!currentSessionId) return;

    terminalSessions.saveTerminalContent(currentSessionId, '', []);
    terminalSessions.saveCommandHistory(currentSessionId, []);
    terminalSessions.saveLastCommand(currentSessionId, '');
    setContentBuffer([]);
  };

  // 监听session变化
  createEffect(() => {
    const currentSessionId = sessionId();
    if (currentSessionId) {
      const session = terminalSessions.getSession(currentSessionId);
      if (session && autoRestore) {
        console.log('[SessionRecovery] Auto-restoring session:', currentSessionId);
        setTimeout(() => restoreSessionState(session), 100);
      }
    }
  });

  // 监听terminal变化
  createEffect(() => {
    if (terminal) {
      startCapture();
      startAutoSave();
    } else {
      stopCapture();
      stopAutoSave();
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
    // 状态
    isRecovering,
    lastSaveTime,
    contentBuffer: () => contentBuffer(),

    // 方法
    saveSessionState,
    restoreSessionState,
    startAutoSave,
    stopAutoSave,
    saveCommand,
    updateWorkingDirectory,
    exportSessionData,
    importSessionData,
    clearSessionData,

    // 快捷方法
    manualSave: saveSessionState,
  };
}