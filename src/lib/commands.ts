/**
 * Slash Commands Reference
 *
 * Lists all available slash commands for different agent types.
 * Used for command autocomplete in ChatInput.
 */

export type AgentType = "claude" | "opencode" | "codex" | "gemini" | "openclaw";

export interface Command {
  name: string;
  description: string;
  agentTypes: AgentType[];
}

// Built-in ClawdChat commands (available for all agents)
export const BUILTIN_COMMANDS: Command[] = [
  { name: "/list", description: "List all sessions", agentTypes: ["claude", "opencode", "codex", "gemini", "openclaw"] },
  { name: "/spawn", description: "Start new agent session", agentTypes: ["claude", "opencode", "codex", "gemini", "openclaw"] },
  { name: "/stop", description: "Stop current session", agentTypes: ["claude", "opencode", "codex", "gemini", "openclaw"] },
  { name: "/quit", description: "Quit application", agentTypes: ["claude", "opencode", "codex", "gemini", "openclaw"] },
  { name: "/approve", description: "Approve permission request", agentTypes: ["claude", "opencode", "codex", "gemini", "openclaw"] },
  { name: "/deny", description: "Deny permission request", agentTypes: ["claude", "opencode", "codex", "gemini", "openclaw"] },
  { name: "/help", description: "Show help information", agentTypes: ["claude", "opencode", "codex", "gemini", "openclaw"] },
];

// Universal commands (passed to agent)
export const UNIVERSAL_COMMANDS: Command[] = [
  { name: "/help", description: "Show agent help", agentTypes: ["claude", "opencode", "codex", "gemini", "openclaw"] },
  { name: "/clear", description: "Clear conversation", agentTypes: ["claude", "opencode", "codex", "gemini", "openclaw"] },
  { name: "/exit", description: "Exit current session", agentTypes: ["claude", "opencode", "codex", "gemini", "openclaw"] },
  { name: "/quit", description: "Quit application", agentTypes: ["claude", "opencode", "codex", "gemini", "openclaw"] },
];

// Claude Code specific commands
export const CLAUDE_COMMANDS: Command[] = [
  { name: "/plugin", description: "Manage plugins", agentTypes: ["claude"] },
  { name: "/skills", description: "List available skills", agentTypes: ["claude"] },
  { name: "/context", description: "Show context information", agentTypes: ["claude"] },
  { name: "/permissions", description: "Manage permissions", agentTypes: ["claude"] },
  { name: "/config", description: "Configure settings", agentTypes: ["claude"] },
  { name: "/cost", description: "Show cost statistics", agentTypes: ["claude"] },
  { name: "/doctor", description: "Run diagnostics", agentTypes: ["claude"] },
  { name: "/hooks", description: "Manage hooks", agentTypes: ["claude"] },
  { name: "/ide", description: "IDE integration", agentTypes: ["claude"] },
  { name: "/compact", description: "Compact context", agentTypes: ["claude"] },
  { name: "/init", description: "Initialize project", agentTypes: ["claude"] },
];

// OpenCode specific commands
export const OPENCODE_COMMANDS: Command[] = [
  { name: "/sessions", description: "List sessions", agentTypes: ["opencode"] },
  { name: "/new", description: "Create new session", agentTypes: ["opencode"] },
  { name: "/undo", description: "Undo last action", agentTypes: ["opencode"] },
  { name: "/redo", description: "Redo last action", agentTypes: ["opencode"] },
  { name: "/editor", description: "Open editor", agentTypes: ["opencode"] },
  { name: "/export", description: "Export session", agentTypes: ["opencode"] },
  { name: "/themes", description: "List themes", agentTypes: ["opencode"] },
  { name: "/models", description: "List models", agentTypes: ["opencode"] },
  { name: "/thinking", description: "Toggle thinking display", agentTypes: ["opencode"] },
];

// Gemini CLI specific commands
export const GEMINI_COMMANDS: Command[] = [
  { name: "/compress", description: "Compress context", agentTypes: ["gemini"] },
  { name: "/editor", description: "Select editor", agentTypes: ["gemini"] },
  { name: "/theme", description: "Switch theme", agentTypes: ["gemini"] },
  { name: "/auth", description: "Manage authentication", agentTypes: ["gemini"] },
  { name: "/about", description: "Show version info", agentTypes: ["gemini"] },
  { name: "/bug", description: "Report a bug", agentTypes: ["gemini"] },
  { name: "/stats", description: "Show statistics", agentTypes: ["gemini"] },
  { name: "/tools", description: "List tools", agentTypes: ["gemini"] },
  { name: "/mcp", description: "Manage MCP servers", agentTypes: ["gemini"] },
  { name: "/memory", description: "Manage memory", agentTypes: ["gemini"] },
  { name: "/restore", description: "Restore files", agentTypes: ["gemini"] },
  { name: "/chat", description: "Chat history", agentTypes: ["gemini"] },
];

// Codex specific commands
export const CODEX_COMMANDS: Command[] = [
  { name: "/lint", description: "Run linter", agentTypes: ["codex"] },
  { name: "/test", description: "Run tests", agentTypes: ["codex"] },
];

// Get all commands for a specific agent type
export function getCommandsForAgent(agentType?: AgentType): Command[] {
  const allCommands: Command[] = [
    ...BUILTIN_COMMANDS,
    ...UNIVERSAL_COMMANDS,
  ];

  if (!agentType) {
    return allCommands;
  }

  // Add agent-specific commands
  switch (agentType) {
    case "claude":
      return [...allCommands, ...CLAUDE_COMMANDS];
    case "opencode":
      return [...allCommands, ...OPENCODE_COMMANDS];
    case "gemini":
      return [...allCommands, ...GEMINI_COMMANDS];
    case "codex":
      return [...allCommands, ...CODEX_COMMANDS];
    case "openclaw":
      return allCommands;
    default:
      return allCommands;
  }
}

// Filter commands by input (for autocomplete)
export function filterCommands(input: string, agentType?: AgentType): Command[] {
  const commands = getCommandsForAgent(agentType);
  const searchTerm = input.toLowerCase().slice(1); // Remove leading '/'

  if (!searchTerm) {
    return commands;
  }

  return commands.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(searchTerm) ||
      cmd.description.toLowerCase().includes(searchTerm)
  );
}
