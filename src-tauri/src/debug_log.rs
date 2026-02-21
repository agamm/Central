use std::fs::OpenOptions;
use std::io::Write;
use std::sync::{Mutex, OnceLock};

static LOG_FILE: OnceLock<Mutex<std::fs::File>> = OnceLock::new();

const LOG_PATH: &str = "/tmp/central-debug.log";

/// Initialize the log file with a Mutex for thread-safe writes
pub fn init_log_path() {
    let file = std::fs::File::create(LOG_PATH).expect("cannot create debug log");
    let mutex = Mutex::new(file);
    let _ = LOG_FILE.set(mutex);
    log("RUST", "=== Central Debug Log Started ===");
}

fn timestamp() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let total_secs = now.as_secs();
    let hours = (total_secs / 3600) % 24;
    let mins = (total_secs / 60) % 60;
    let secs = total_secs % 60;
    let millis = now.subsec_millis();
    format!("{hours:02}:{mins:02}:{secs:02}.{millis:03}")
}

/// Append a log line — Mutex ensures no interleaving from concurrent threads
pub fn log(source: &str, message: &str) {
    let mutex = match LOG_FILE.get() {
        Some(m) => m,
        None => return,
    };

    let ts = timestamp();
    let line = format!("[{ts}] [{source}] {message}\n");

    if let Ok(mut guard) = mutex.lock() {
        // Re-open in append mode each time so we never hold the fd across calls.
        // The Mutex serialises access; the open+append is atomic on POSIX.
        if let Ok(mut f) = OpenOptions::new().append(true).open(LOG_PATH) {
            let _ = f.write_all(line.as_bytes());
        } else {
            // Fallback: try writing to the original fd
            let _ = guard.write_all(line.as_bytes());
        }
    }
}

/// Tauri command so the React frontend can write to the same log file
#[tauri::command]
pub fn debug_log(source: String, message: String) {
    log(&source, &message);
}
