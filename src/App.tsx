import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ProjectSidebar } from "@/features/projects";
import { ChatPane, useAgentEvents } from "@/features/agents";
import { FilesPlaceholder } from "@/features/files/FilesPlaceholder";

function App() {
  useAgentEvents();

  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
        <ResizablePanelGroup orientation="horizontal" className="h-full">
          <ResizablePanel
            defaultSize={20}
            minSize={15}
            className="border-r border-border"
          >
            <ProjectSidebar />
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel defaultSize={50} minSize={25}>
            <ChatPane />
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel
            defaultSize={30}
            minSize={20}
            className="border-l border-border"
          >
            <FilesPlaceholder />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </TooltipProvider>
  );
}

export { App };
