import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ProjectSidebar } from "@/features/projects";
import { ChatPane, useAgentEvents } from "@/features/agents";
import { RightPane } from "@/features/terminal/components/RightPane";
import { PaneErrorBoundary } from "@/components/PaneErrorBoundary";
import { useBootstrap } from "@/hooks/useBootstrap";
import { useAgentTimeout } from "@/hooks/useAgentTimeout";
import { BootstrapLoading } from "@/components/BootstrapLoading";

function App() {
  const { loading } = useBootstrap();
  useAgentEvents();
  useAgentTimeout();

  if (loading) {
    return <BootstrapLoading />;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
        <ResizablePanelGroup orientation="horizontal" className="h-full">
          <ResizablePanel
            defaultSize={20}
            minSize={15}
            className="border-r border-border"
          >
            <PaneErrorBoundary paneName="Sidebar">
              <ProjectSidebar />
            </PaneErrorBoundary>
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel defaultSize={50} minSize={25}>
            <PaneErrorBoundary paneName="Chat">
              <ChatPane />
            </PaneErrorBoundary>
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel
            defaultSize={30}
            minSize={20}
            className="border-l border-border"
          >
            <PaneErrorBoundary paneName="Files & Terminal">
              <RightPane />
            </PaneErrorBoundary>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </TooltipProvider>
  );
}

export { App };
