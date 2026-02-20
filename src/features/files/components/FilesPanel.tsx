import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { useProjectStore } from "@/features/projects/store";
import { useFilesStore } from "../store";
import { FileTree } from "./FileTree";
import { FileViewer } from "./FileViewer";
import { DiffViewer } from "./DiffViewer";
import { GitStatusBar } from "./GitStatusBar";
import { FilesPanelEmpty } from "./FilesPanelEmpty";

function FilesPanel() {
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const projects = useProjectStore((s) => s.projects);
  const gitStatus = useFilesStore((s) => s.gitStatus);

  const project = projects.find((p) => p.id === selectedProjectId);

  if (!project) {
    return <FilesPanelEmpty hasProject={false} />;
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <ResizablePanelGroup orientation="vertical" className="flex-1">
        <ResizablePanel defaultSize={40} minSize={20}>
          <FileTree projectPath={project.path} />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={60} minSize={20}>
          <FileContentArea projectPath={project.path} />
        </ResizablePanel>
      </ResizablePanelGroup>
      <GitStatusBar status={gitStatus} />
    </div>
  );
}

interface FileContentAreaProps {
  readonly projectPath: string;
}

function FileContentArea({ projectPath: _projectPath }: FileContentAreaProps) {
  const selectedFilePath = useFilesStore((s) => s.selectedFilePath);
  const viewMode = useFilesStore((s) => s.viewMode);
  const fileContent = useFilesStore((s) => s.fileContent);
  const fileDiffs = useFilesStore((s) => s.fileDiffs);
  const loading = useFilesStore((s) => s.loading);
  const error = useFilesStore((s) => s.error);

  if (!selectedFilePath) {
    return <FilesPanelEmpty hasProject={true} />;
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <p className="text-xs text-red-400">{error}</p>
      </div>
    );
  }

  if (viewMode === "diff") {
    return <DiffViewer diffs={fileDiffs} filePath={selectedFilePath} />;
  }

  if (fileContent !== null) {
    return <FileViewer content={fileContent} filePath={selectedFilePath} />;
  }

  return <FilesPanelEmpty hasProject={true} />;
}

export { FilesPanel };
