export class Command {
  constructor(_program: string, _args: string[] = []) {}

  async execute(): Promise<{ code: number; stdout: string; stderr: string }> {
    console.warn("[tauri-shell shim] Command.execute is not supported in browser mode");
    return { code: 1, stdout: "", stderr: "Shell commands are not supported in browser mode" };
  }

  on(_event: string, _handler: (data: { line: string }) => void): void {}

  spawn(): Promise<void> {
    console.warn("[tauri-shell shim] Command.spawn is not supported in browser mode");
    return Promise.resolve();
  }
}

export async function execute(_program: string, _args?: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  console.warn("[tauri-shell shim] execute is not supported in browser mode");
  return { code: 1, stdout: "", stderr: "Shell commands are not supported in browser mode" };
}
