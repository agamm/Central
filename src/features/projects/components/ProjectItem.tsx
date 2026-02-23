import { useState, useCallback, type ReactNode } from "react";
import {
  Folder,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  Plus,
  MessageSquare,
} from "lucide-react";
import { ClaudeIcon } from "@/components/icons/ClaudeIcon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import type { Project } from "@/core/types";

interface ProjectItemProps {
  readonly project: Project;
  readonly isSelected: boolean;
  readonly isExpanded: boolean;
  readonly onSelect: (id: string) => void;
  readonly onRename: (id: string, name: string) => void;
  readonly onDelete: (id: string) => void;
  readonly onNewChat?: (projectId: string) => void;
  readonly onNewTerminal?: (projectId: string) => void;
  readonly children?: ReactNode;
}

function ProjectItem({
  project,
  isSelected: _isSelected,
  isExpanded,
  onSelect,
  onRename,
  onDelete,
  onNewChat,
  onNewTerminal,
  children,
}: ProjectItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);

  const handleClick = useCallback(() => {
    if (!isEditing) {
      onSelect(project.id);
    }
  }, [isEditing, onSelect, project.id]);

  const handleStartRename = useCallback(() => {
    setEditName(project.name);
    setIsEditing(true);
  }, [project.name]);

  const handleConfirmRename = useCallback(() => {
    const trimmed = editName.trim();
    if (trimmed.length > 0 && trimmed !== project.name) {
      onRename(project.id, trimmed);
    }
    setIsEditing(false);
  }, [editName, project.id, project.name, onRename]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleConfirmRename();
      } else if (e.key === "Escape") {
        setIsEditing(false);
      }
    },
    [handleConfirmRename],
  );

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleClick();
        }}
        className={cn(
          "group flex items-center gap-1 rounded px-2 py-1 text-sm",
          "cursor-pointer",
          isExpanded && "border-l-2 border-l-foreground/30",
        )}
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150",
            isExpanded && "rotate-90",
          )}
        />
        <Folder className={cn("h-3.5 w-3.5 shrink-0", isExpanded ? "text-foreground/70" : "text-muted-foreground/70")} />

        {isEditing ? (
          <Input
            value={editName}
            onChange={(e) => {
              setEditName(e.target.value);
            }}
            onBlur={handleConfirmRename}
            onKeyDown={handleKeyDown}
            className="h-6 px-1 py-0 text-sm"
            autoFocus
            onClick={(e) => {
              e.stopPropagation();
            }}
          />
        ) : (
          <span className="flex-1 truncate text-foreground/85">
            {project.name}
          </span>
        )}

        {!isEditing && (onNewChat || onNewTerminal) && (
          <DropdownMenu>
            <DropdownMenuTrigger
              onClick={(e) => {
                e.stopPropagation();
              }}
              className="shrink-0 rounded p-0.5 hover:bg-accent"
              aria-label="New session"
            >
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {onNewChat && (
                <DropdownMenuItem
                  onSelect={() => {
                    onNewChat(project.id);
                  }}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  New Chat
                </DropdownMenuItem>
              )}
              {onNewTerminal && (
                <DropdownMenuItem
                  onSelect={() => {
                    onNewTerminal(project.id);
                  }}
                >
                  <ClaudeIcon className="h-3.5 w-3.5 text-[#d97757]" />
                  New Claude Code
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {!isEditing && (
          <DropdownMenu>
            <DropdownMenuTrigger
              onClick={(e) => {
                e.stopPropagation();
              }}
              className="rounded p-0.5 hover:bg-muted"
            >
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={handleStartRename}>
                <Pencil className="h-3.5 w-3.5" />
                Rename
              </DropdownMenuItem>
              <ConfirmDialog
                trigger={
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </DropdownMenuItem>
                }
                title={`Delete "${project.name}"?`}
                description="This will delete the project and all its sessions. This action cannot be undone."
                onConfirm={() => {
                  onDelete(project.id);
                }}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {isExpanded && children && <div className="pb-1">{children}</div>}
    </div>
  );
}

export { ProjectItem };
