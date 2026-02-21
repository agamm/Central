import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProjectItem } from "./ProjectItem";
import { EmptyProjectState } from "./EmptyProjectState";
import { AgentList } from "@/features/agents/components/AgentList";
import { useProjectStore } from "../store";
import { useAgentStore } from "@/features/agents/store";
import * as agentApi from "@/features/agents/api";
import { debugLog } from "@/shared/debugLog";

interface ProjectListProps {
  readonly onAddProject: () => void;
}

function ProjectList({ onAddProject }: ProjectListProps) {
  const projects = useProjectStore((s) => s.projects);
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const selectProject = useProjectStore((s) => s.selectProject);
  const renameProject = useProjectStore((s) => s.renameProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const switchSession = useAgentStore((s) => s.switchSession);
  const setMessages = useAgentStore((s) => s.setMessages);
  const messagesBySession = useAgentStore((s) => s.messagesBySession);
  const clearSessionData = useAgentStore((s) => s.clearSessionData);

  const handleSelect = useCallback(
    (id: string) => {
      selectProject(id);
    },
    [selectProject],
  );

  const handleRename = useCallback(
    (id: string, name: string) => {
      void renameProject(id, name);
    },
    [renameProject],
  );

  const handleDelete = useCallback(
    (id: string) => {
      void deleteProject(id);
    },
    [deleteProject],
  );

  const handleSessionSelect = useCallback(
    (sessionId: string, projectId: string) => {
      selectProject(projectId);
      switchSession(sessionId);

      // Lazy-load messages if not already in store
      if (!messagesBySession.has(sessionId)) {
        void loadSessionMessages(sessionId, setMessages);
      }
    },
    [selectProject, switchSession, messagesBySession, setMessages],
  );

  const handleNewChat = useCallback(() => {
    // Clear active session so ChatPane shows empty state with prompt input
    switchSession(null);
  }, [switchSession]);

  const handleSessionDelete = useCallback(
    (sessionId: string) => {
      // Try to kill the worker if one exists (ignore errors for stale sessions)
      void invoke("abort_agent_session", { sessionId }).catch(() => {});
      // Delete from DB
      void agentApi.deleteSession(sessionId).then((result) => {
        result.match(
          () => debugLog("REACT", `Session ${sessionId} deleted from DB`),
          (e) => debugLog("REACT", `Failed to delete session ${sessionId}: ${e}`),
        );
      });
      // Clear from store (switches away if this was the active session)
      clearSessionData(sessionId);
    },
    [clearSessionData],
  );

  if (projects.length === 0) {
    return <EmptyProjectState onAddProject={onAddProject} />;
  }

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-0.5 p-2">
        {projects.map((project) => (
          <ProjectItem
            key={project.id}
            project={project}
            isSelected={selectedProjectId === project.id}
            isExpanded={selectedProjectId === project.id}
            onSelect={handleSelect}
            onRename={handleRename}
            onDelete={handleDelete}
          >
            <AgentList
              projectId={project.id}
              onSessionSelect={handleSessionSelect}
              onSessionDelete={handleSessionDelete}
              onNewChat={handleNewChat}
            />
          </ProjectItem>
        ))}
      </div>
    </ScrollArea>
  );
}

async function loadSessionMessages(
  sessionId: string,
  setMessages: (
    sid: string,
    msgs: readonly import("@/core/types").Message[],
  ) => void,
): Promise<void> {
  const result = await agentApi.getMessages(sessionId);
  result.match(
    (messages) => {
      setMessages(sessionId, messages);
    },
    () => {
      /* Messages will load when events arrive */
    },
  );
}

export { ProjectList };
