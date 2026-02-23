use std::collections::HashMap;
use std::io::{Read, Write};
use std::thread;

use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use portable_pty::{native_pty_system, CommandBuilder, PtySize, MasterPty, Child};
use tauri::ipc::Channel;

use super::types::PtyEvent;
use crate::debug_log;

/// One PTY session
struct PtySession {
    master: Box<dyn MasterPty + Send>,
    child: Box<dyn Child + Send + Sync>,
    writer: Box<dyn Write + Send>,
}

impl PtySession {
    fn kill(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

/// Manages PTY sessions, one per terminal session
pub struct PtyManager {
    sessions: HashMap<String, PtySession>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    /// Start a new PTY running `claude` CLI
    pub fn start_terminal(
        &mut self,
        session_id: String,
        cwd: String,
        rows: u16,
        cols: u16,
        channel: Channel<PtyEvent>,
    ) -> Result<(), String> {
        if self.sessions.contains_key(&session_id) {
            return Err(format!("PTY session already exists: {session_id}"));
        }

        let pty_system = native_pty_system();

        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pair = pty_system
            .openpty(size)
            .map_err(|e| format!("Failed to open PTY: {e}"))?;

        let mut cmd = CommandBuilder::new("claude");
        cmd.cwd(&cwd);

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn claude: {e}"))?;

        // Drop slave — we only need the master side
        drop(pair.slave);

        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone PTY reader: {e}"))?;

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to take PTY writer: {e}"))?;

        let sid = session_id.clone();

        // Spawn reader thread: reads raw bytes, base64-encodes, sends via Channel
        thread::spawn(move || {
            let mut reader = reader;
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        // EOF — process likely exited
                        let _ = channel.send(PtyEvent::Exit { code: 0 });
                        break;
                    }
                    Ok(n) => {
                        let encoded = BASE64.encode(&buf[..n]);
                        if channel.send(PtyEvent::Output { data: encoded }).is_err() {
                            debug_log::log("PTY", &format!("Channel closed for {sid}"));
                            break;
                        }
                    }
                    Err(e) => {
                        let _ = channel.send(PtyEvent::Error {
                            message: format!("Read error: {e}"),
                        });
                        break;
                    }
                }
            }
            debug_log::log("PTY", &format!("Reader thread exiting for {sid}"));
        });

        debug_log::log("PTY", &format!("Started terminal: {session_id} in {cwd}"));

        self.sessions.insert(
            session_id,
            PtySession {
                master: pair.master,
                child,
                writer,
            },
        );

        Ok(())
    }

    /// Write base64-encoded input to a PTY session
    pub fn write_input(&mut self, session_id: &str, data: &str) -> Result<(), String> {
        let session = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("PTY session not found: {session_id}"))?;

        let bytes = BASE64
            .decode(data)
            .map_err(|e| format!("Base64 decode error: {e}"))?;

        session
            .writer
            .write_all(&bytes)
            .map_err(|e| format!("Write error: {e}"))?;

        session
            .writer
            .flush()
            .map_err(|e| format!("Flush error: {e}"))?;

        Ok(())
    }

    /// Resize a PTY session
    pub fn resize(&mut self, session_id: &str, rows: u16, cols: u16) -> Result<(), String> {
        let session = self
            .sessions
            .get(session_id)
            .ok_or_else(|| format!("PTY session not found: {session_id}"))?;

        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Resize error: {e}"))?;

        Ok(())
    }

    /// Close a PTY session and kill the process
    pub fn close(&mut self, session_id: &str) {
        if let Some(mut session) = self.sessions.remove(session_id) {
            session.kill();
            debug_log::log("PTY", &format!("Closed terminal: {session_id}"));
        }
    }

    /// Shut down all PTY sessions
    pub fn shutdown(&mut self) {
        let ids: Vec<String> = self.sessions.keys().cloned().collect();
        for id in ids {
            self.close(&id);
        }
        debug_log::log("PTY", "All PTY sessions shut down");
    }
}

impl Drop for PtyManager {
    fn drop(&mut self) {
        self.shutdown();
    }
}
