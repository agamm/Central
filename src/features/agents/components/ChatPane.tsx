import { useMessageStore } from "../stores/messageStore";
import { useChatSession } from "../hooks/useChatSession";
import { useChatActions } from "../hooks/useChatActions";
import { MessageList } from "./MessageList";
import { MessageQueue } from "./MessageQueue";
import { PromptInput } from "./PromptInput";
import { ChatEmptyState } from "./ChatEmptyState";
import { ToolApprovalDialog } from "./ToolApprovalDialog";

function ChatPane() {
  const session = useChatSession();
  const { handleSubmit, handleAbort, handleScrollChange } = useChatActions(session);
  const cancelQueued = useMessageStore((s) => s.cancelQueuedMessage);
  const editQueued = useMessageStore((s) => s.editQueuedMessage);

  const hasMessages = session.messages.length > 0;

  return (
    <div className="flex h-full flex-col bg-background">
      {hasMessages ? (
        <MessageList
          messages={session.messages}
          initialScrollPosition={session.scrollPosition}
          onScrollPositionChange={handleScrollChange}
          isRunning={session.isRunning}
          liveElapsedSeconds={session.liveElapsedSeconds}
          finalElapsedMs={session.finalElapsedMs}
          tokenUsage={session.tokenUsage}
        />
      ) : (
        <ChatEmptyState projectName={session.selectedProject?.name} />
      )}

      {session.sessionQueue.length > 0 && (
        <MessageQueue
          messages={session.sessionQueue}
          onCancel={cancelQueued}
          onEdit={editQueued}
        />
      )}

      {session.hasPendingApprovals && session.activeSessionId && (
        <ToolApprovalDialog sessionId={session.activeSessionId} />
      )}

      <PromptInput
        onSubmit={(msg) => void handleSubmit(msg)}
        onAbort={() => void handleAbort()}
        isRunning={session.isRunning}
        disabled={!session.selectedProjectId}
        sessionId={session.activeSessionId ?? undefined}
        placeholder={
          session.isRunning
            ? "Message will be queued..."
            : "Send a message to start an agent..."
        }
      />
    </div>
  );
}

export { ChatPane };
