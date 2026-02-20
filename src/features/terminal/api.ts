import { invoke } from "@tauri-apps/api/core";
import { ok, err, type Result } from "neverthrow";

async function ptySpawn(
  ptyId: string,
  cwd: string,
  rows: number,
  cols: number,
): Promise<Result<void, string>> {
  try {
    await invoke("pty_spawn", { ptyId, cwd, rows, cols });
    return ok(undefined);
  } catch (e) {
    return err(`Failed to spawn PTY: ${String(e)}`);
  }
}

async function ptyWrite(
  ptyId: string,
  data: string,
): Promise<Result<void, string>> {
  try {
    await invoke("pty_write", { ptyId, data });
    return ok(undefined);
  } catch (e) {
    return err(`Failed to write to PTY: ${String(e)}`);
  }
}

async function ptyResize(
  ptyId: string,
  rows: number,
  cols: number,
): Promise<Result<void, string>> {
  try {
    await invoke("pty_resize", { ptyId, rows, cols });
    return ok(undefined);
  } catch (e) {
    return err(`Failed to resize PTY: ${String(e)}`);
  }
}

async function ptyKill(ptyId: string): Promise<Result<void, string>> {
  try {
    await invoke("pty_kill", { ptyId });
    return ok(undefined);
  } catch (e) {
    return err(`Failed to kill PTY: ${String(e)}`);
  }
}

export { ptySpawn, ptyWrite, ptyResize, ptyKill };
