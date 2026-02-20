use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
pub struct FileTreeEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<FileTreeEntry>,
    pub git_status: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct GitStatusInfo {
    pub branch: String,
    pub ahead: usize,
    pub behind: usize,
    pub is_repo: bool,
    pub changed_files: Vec<ChangedFile>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ChangedFile {
    pub path: String,
    pub status: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct FileDiff {
    pub path: String,
    pub hunks: Vec<DiffHunk>,
}

#[derive(Debug, Serialize, Clone)]
pub struct DiffHunk {
    pub header: String,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Serialize, Clone)]
pub struct DiffLine {
    pub content: String,
    pub origin: String,
    pub old_lineno: Option<u32>,
    pub new_lineno: Option<u32>,
}
