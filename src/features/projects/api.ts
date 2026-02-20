import Database from "@tauri-apps/plugin-sql";
import { ok, err, type Result } from "neverthrow";
import type { Project } from "@/core/types";
import { DB_NAME } from "@/core/constants";

/** Raw row shape from SQLite (snake_case) */
interface ProjectRow {
  readonly id: string;
  readonly path: string;
  readonly name: string;
  readonly created_at: string;
  readonly deleted_at: string | null;
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    path: row.path,
    name: row.name,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

function generateId(): string {
  return crypto.randomUUID();
}

function getDb(): Database {
  return Database.get(DB_NAME);
}

async function listProjects(): Promise<Result<Project[], string>> {
  try {
    const db = getDb();
    const rows = await db.select<ProjectRow[]>(
      "SELECT id, path, name, created_at, deleted_at FROM projects WHERE deleted_at IS NULL ORDER BY created_at DESC",
    );
    return ok(rows.map(rowToProject));
  } catch (e) {
    return err(`Failed to list projects: ${String(e)}`);
  }
}

async function addProject(
  path: string,
  name: string,
): Promise<Result<Project, string>> {
  try {
    const db = getDb();
    const id = generateId();
    const createdAt = new Date().toISOString();

    await db.execute(
      "INSERT INTO projects (id, path, name, created_at) VALUES ($1, $2, $3, $4)",
      [id, path, name, createdAt],
    );

    return ok({ id, path, name, createdAt, deletedAt: null });
  } catch (e) {
    return err(`Failed to add project: ${String(e)}`);
  }
}

async function renameProject(
  id: string,
  name: string,
): Promise<Result<void, string>> {
  try {
    const db = getDb();
    const result = await db.execute(
      "UPDATE projects SET name = $1 WHERE id = $2 AND deleted_at IS NULL",
      [name, id],
    );

    if (result.rowsAffected === 0) {
      return err("Project not found");
    }

    return ok(undefined);
  } catch (e) {
    return err(`Failed to rename project: ${String(e)}`);
  }
}

async function deleteProject(id: string): Promise<Result<void, string>> {
  try {
    const db = getDb();
    const deletedAt = new Date().toISOString();
    const result = await db.execute(
      "UPDATE projects SET deleted_at = $1 WHERE id = $2 AND deleted_at IS NULL",
      [deletedAt, id],
    );

    if (result.rowsAffected === 0) {
      return err("Project not found");
    }

    return ok(undefined);
  } catch (e) {
    return err(`Failed to delete project: ${String(e)}`);
  }
}

export { listProjects, addProject, renameProject, deleteProject };
