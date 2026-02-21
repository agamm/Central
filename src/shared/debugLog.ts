import { invoke } from "@tauri-apps/api/core";

/** Write a debug log entry that goes to central-debug.log via Rust */
function debugLog(source: string, message: string): void {
  invoke("debug_log", { source, message }).catch(() => {
    // Silently ignore if Rust isn't ready yet
  });
}

export { debugLog };
