import { useProjectStore } from "@/features/projects/store";
import { TerminalView } from "./TerminalView";
import { TerminalEmpty } from "./TerminalEmpty";

function TerminalPanel() {
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const projects = useProjectStore((s) => s.projects);

  const project = projects.find((p) => p.id === selectedProjectId);

  if (!project) {
    return <TerminalEmpty />;
  }

  return (
    <TerminalView
      key={project.id}
      projectId={project.id}
      cwd={project.path}
    />
  );
}

export { TerminalPanel };
