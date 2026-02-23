pub mod manager;
pub mod types;

use std::sync::{Arc, Mutex};

pub use manager::PtyManager;
pub use types::PtyEvent;

/// Thread-safe handle to the PTY manager
pub type PtyHandle = Arc<Mutex<PtyManager>>;

/// Create a new PTY handle for Tauri state
pub fn create_pty_handle() -> PtyHandle {
    Arc::new(Mutex::new(PtyManager::new()))
}
