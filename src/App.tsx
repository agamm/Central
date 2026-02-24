import { useMemo } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ProjectSidebar } from "@/features/projects";
import { ChatPane, useAgentEvents } from "@/features/agents";
import {
  FilesPanel,
  FileViewer,
  DiffViewer,
  useFilesStore,
} from "@/features/files";
import { TerminalPane } from "@/features/terminal";
import { PaneErrorBoundary } from "@/components/PaneErrorBoundary";
import { useBootstrap } from "@/hooks/useBootstrap";
import { useAgentTimeout } from "@/hooks/useAgentTimeout";
import { BootstrapLoading } from "@/components/BootstrapLoading";
import { SettingsPane, useSettingsStore } from "@/features/settings";
import { useAgentStore } from "@/features/agents/store";
import { useProjectStore } from "@/features/projects/store";
import { CommandPalette } from "@/components/CommandPalette";

function CenterPane() {
  const viewingFileInCenter = useFilesStore((s) => s.viewingFileInCenter);
  const centerFilePath = useFilesStore((s) => s.centerFilePath);
  const centerFileContent = useFilesStore((s) => s.centerFileContent);
  const centerFileDiffs = useFilesStore((s) => s.centerFileDiffs);
  const centerViewMode = useFilesStore((s) => s.centerViewMode);

  const activeSessionId = useAgentStore((s) => s.activeSessionId);
  const sessions = useAgentStore((s) => s.sessions);
  const projects = useProjectStore((s) => s.projects);

  const activeSession = activeSessionId ? sessions.get(activeSessionId) : undefined;
  const showingTerminal = activeSession?.sessionType === "terminal";
  const showingFile = viewingFileInCenter && centerFilePath;

  // Collect all terminal sessions with their project paths
  const terminalEntries = useMemo(() => {
    const entries: { sessionId: string; cwd: string }[] = [];
    for (const s of sessions.values()) {
      if (s.sessionType !== "terminal") continue;
      const project = projects.find((p) => p.id === s.projectId);
      if (project) entries.push({ sessionId: s.id, cwd: project.path });
    }
    return entries;
  }, [sessions, projects]);

  return (
    <div className="relative h-full w-full">
      {/* File viewer — shown on top when active */}
      {showingFile && (
        <div className="absolute inset-0 z-10">
          {centerViewMode === "diff" ? (
            <DiffViewer diffs={centerFileDiffs} filePath={centerFilePath} />
          ) : centerFileContent !== null ? (
            <FileViewer content={centerFileContent} filePath={centerFilePath} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-xs text-muted-foreground">Loading...</p>
            </div>
          )}
        </div>
      )}

      {/* Chat pane — hidden when a terminal or file is active */}
      {!showingTerminal && !showingFile && <ChatPane />}

      {/* All terminals always mounted — only the active one is visible.
          This prevents canvas context loss from mount/unmount cycles. */}
      {terminalEntries.map(({ sessionId, cwd }) => (
        <div
          key={sessionId}
          className="absolute inset-0"
          style={{
            visibility: sessionId === activeSessionId && !showingFile ? "visible" : "hidden",
            pointerEvents: sessionId === activeSessionId && !showingFile ? "auto" : "none",
          }}
        >
          <TerminalPane sessionId={sessionId} cwd={cwd} />
        </div>
      ))}
    </div>
  );
}

function MainLayout() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
      <ResizablePanelGroup orientation="horizontal" className="h-full">
        <ResizablePanel defaultSize="2" minSize={300}>
          <PaneErrorBoundary paneName="Sidebar">
            <ProjectSidebar />
          </PaneErrorBoundary>
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel defaultSize={50} minSize={400}>
          <PaneErrorBoundary paneName="Center">
            <CenterPane />
          </PaneErrorBoundary>
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel defaultSize={30} minSize={300}>
          <PaneErrorBoundary paneName="Files">
            <FilesPanel />
          </PaneErrorBoundary>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function App() {
  const { loading } = useBootstrap();
  const showSettings = useSettingsStore((s) => s.showSettings);
  useAgentEvents();
  useAgentTimeout();

  if (loading) {
    return <BootstrapLoading />;
  }

  if (showSettings) {
    return <SettingsPane />;
  }

  return (
    <CommandPalette>
      <TooltipProvider delayDuration={300}>
        <MainLayout />
      </TooltipProvider>
    </CommandPalette>
  );
}

export { App };
