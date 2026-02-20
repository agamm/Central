import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AddProjectDialogProps {
  readonly open: boolean;
  readonly folderPath: string;
  readonly defaultName: string;
  readonly onConfirm: (name: string) => void;
  readonly onCancel: () => void;
}

function AddProjectDialog({
  open,
  folderPath,
  defaultName,
  onConfirm,
  onCancel,
}: AddProjectDialogProps) {
  const [name, setName] = useState(defaultName);

  const handleConfirm = useCallback(() => {
    const trimmed = name.trim();
    if (trimmed.length > 0) {
      onConfirm(trimmed);
    }
  }, [name, onConfirm]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleConfirm();
      }
    },
    [handleConfirm],
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Project</DialogTitle>
          <DialogDescription>
            Confirm the project name and folder path.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="project-name"
              className="text-xs font-medium text-muted-foreground"
            >
              Project Name
            </label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => { setName(e.target.value); }}
              onKeyDown={handleKeyDown}
              placeholder="My Project"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Folder Path
            </span>
            <p className="truncate rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
              {folderPath}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={name.trim().length === 0}
          >
            Add Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { AddProjectDialog };
