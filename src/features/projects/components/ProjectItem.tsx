import { useState, useCallback, type ReactNode } from "react";
import { Folder, ChevronRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Project } from "@/core/types";

interface ProjectItemProps {
  readonly project: Project;
  readonly isSelected: boolean;
  readonly isExpanded: boolean;
  readonly onSelect: (id: string) => void;
  readonly onRename: (id: string, name: string) => void;
  readonly onDelete: (id: string) => void;
  readonly children?: ReactNode;
}

function ProjectItem({
  project,
  isSelected,
  isExpanded,
  onSelect,
  onRename,
  onDelete,
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
        onKeyDown={(e) => { if (e.key === "Enter") handleClick(); }}
        className={cn(
          "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors",
          "cursor-pointer hover:bg-accent",
          isSelected && "bg-muted",
        )}
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150",
            isExpanded && "rotate-90",
          )}
        />
        <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />

        {isEditing ? (
          <Input
            value={editName}
            onChange={(e) => { setEditName(e.target.value); }}
            onBlur={handleConfirmRename}
            onKeyDown={handleKeyDown}
            className="h-6 px-1 py-0 text-sm"
            autoFocus
            onClick={(e) => { e.stopPropagation(); }}
          />
        ) : (
          <span className="flex-1 truncate">{project.name}</span>
        )}

        {!isEditing && (
          <DropdownMenu>
            <DropdownMenuTrigger
              onClick={(e) => { e.stopPropagation(); }}
              className="invisible rounded p-0.5 hover:bg-muted group-hover:visible"
            >
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={handleStartRename}>
                <Pencil className="h-3.5 w-3.5" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => { onDelete(project.id); }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {isExpanded && children && (
        <div className="pb-1">{children}</div>
      )}
    </div>
  );
}

export { ProjectItem };
