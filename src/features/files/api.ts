import { invoke } from "@tauri-apps/api/core";
import { ok, err, type Result } from "neverthrow";
import type { FileTreeEntry, GitStatusInfo, FileDiff } from "./types";

async function getFileTree(
  projectPath: string,
): Promise<Result<readonly FileTreeEntry[], string>> {
  try {
    const tree = await invoke<FileTreeEntry[]>("get_file_tree", {
      projectPath,
    });
    return ok(tree);
  } catch (e) {
    return err(`Failed to get file tree: ${String(e)}`);
  }
}

async function getGitStatus(
  projectPath: string,
): Promise<Result<GitStatusInfo, string>> {
  try {
    const status = await invoke<GitStatusInfo>("get_git_status", {
      projectPath,
    });
    return ok(status);
  } catch (e) {
    return err(`Failed to get git status: ${String(e)}`);
  }
}

async function getFileContent(
  projectPath: string,
  filePath: string,
): Promise<Result<string, string>> {
  try {
    const content = await invoke<string>("get_file_content", {
      projectPath,
      filePath,
    });
    return ok(content);
  } catch (e) {
    return err(`Failed to read file: ${String(e)}`);
  }
}

async function getDiff(
  projectPath: string,
  filePath?: string,
): Promise<Result<readonly FileDiff[], string>> {
  try {
    const diffs = await invoke<FileDiff[]>("get_diff", {
      projectPath,
      filePath: filePath ?? null,
    });
    return ok(diffs);
  } catch (e) {
    return err(`Failed to get diff: ${String(e)}`);
  }
}

async function writeFile(
  projectPath: string,
  filePath: string,
  content: string,
): Promise<Result<undefined, string>> {
  try {
    await invoke<null>("write_file", {
      projectPath,
      filePath,
      content,
    });
    return ok(undefined);
  } catch (e) {
    return err(`Failed to write file: ${String(e)}`);
  }
}

export { getFileTree, getGitStatus, getFileContent, getDiff, writeFile };
