import { useState } from "react";
import { X, Pencil, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { QueuedMessage } from "../types";

interface MessageQueueProps {
  readonly messages: readonly QueuedMessage[];
  readonly onCancel: (messageId: string) => void;
  readonly onEdit: (messageId: string, content: string) => void;
}

function QueueItem({
  message,
  onCancel,
  onEdit,
}: {
  readonly message: QueuedMessage;
  readonly onCancel: (id: string) => void;
  readonly onEdit: (id: string, content: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);

  const handleSaveEdit = () => {
    if (editValue.trim().length > 0) {
      onEdit(message.id, editValue.trim());
    }
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2 rounded border border-border/40 bg-muted/20 px-2 py-1.5">
      <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />

      {editing ? (
        <div className="flex flex-1 items-center gap-1">
          <Input
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveEdit();
              if (e.key === "Escape") setEditing(false);
            }}
            className="h-6 text-xs"
            autoFocus
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0"
            onClick={handleSaveEdit}
          >
            <Check className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <span className="flex-1 truncate text-xs text-muted-foreground">
          {message.content}
        </span>
      )}

      {!editing && (
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => {
              setEditValue(message.content);
              setEditing(true);
            }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => {
              onCancel(message.id);
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

function MessageQueue({ messages, onCancel, onEdit }: MessageQueueProps) {
  if (messages.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 border-t border-border/50 px-4 py-2">
      <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
        Queued ({messages.length})
      </div>
      {messages.map((msg) => (
        <QueueItem
          key={msg.id}
          message={msg}
          onCancel={onCancel}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}

export { MessageQueue };
