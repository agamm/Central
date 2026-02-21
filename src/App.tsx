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
import { PaneErrorBoundary } from "@/components/PaneErrorBoundary";
import { useBootstrap } from "@/hooks/useBootstrap";
import { useAgentTimeout } from "@/hooks/useAgentTimeout";
import { BootstrapLoading } from "@/components/BootstrapLoading";
import { SettingsPane, useSettingsStore } from "@/features/settings";

function CenterPane() {
  const viewingFileInCenter = useFilesStore((s) => s.viewingFileInCenter);
  const centerFilePath = useFilesStore((s) => s.centerFilePath);
  const centerFileContent = useFilesStore((s) => s.centerFileContent);
  const centerFileDiffs = useFilesStore((s) => s.centerFileDiffs);
  const centerViewMode = useFilesStore((s) => s.centerViewMode);

  if (viewingFileInCenter && centerFilePath) {
    if (centerViewMode === "diff") {
      return <DiffViewer diffs={centerFileDiffs} filePath={centerFilePath} />;
    }
    if (centerFileContent !== null) {
      return (
        <FileViewer content={centerFileContent} filePath={centerFilePath} />
      );
    }
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return <ChatPane />;
}

function MainLayout() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
      <ResizablePanelGroup orientation="horizontal" className="h-full">
        <ResizablePanel defaultSize={20} minSize={15}>
          <PaneErrorBoundary paneName="Sidebar">
            <ProjectSidebar />
          </PaneErrorBoundary>
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel defaultSize={50} minSize={25}>
          <PaneErrorBoundary paneName="Center">
            <CenterPane />
          </PaneErrorBoundary>
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel defaultSize={30} minSize={20}>
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
    <TooltipProvider delayDuration={300}>
      <MainLayout />
    </TooltipProvider>
  );
}

export { App };
