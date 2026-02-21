import { useProjectStore } from "@/features/projects/store";
import { useFilesStore } from "../store";
import { FileTree } from "./FileTree";
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
      <div className="flex-1 overflow-hidden">
        <FileTree projectPath={project.path} />
      </div>
      <GitStatusBar status={gitStatus} />
    </div>
  );
}

export { FilesPanel };
