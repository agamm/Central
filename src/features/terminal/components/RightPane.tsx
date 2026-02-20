import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { FilesPanel } from "@/features/files";
import { TerminalPanel } from "./TerminalPanel";

/** Right pane: file viewer (top) + terminal (bottom) with resizable split */
function RightPane() {
  return (
    <ResizablePanelGroup orientation="vertical" className="h-full">
      <ResizablePanel defaultSize={60} minSize={20}>
        <FilesPanel />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={40} minSize={15}>
        <TerminalPanel />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export { RightPane };
