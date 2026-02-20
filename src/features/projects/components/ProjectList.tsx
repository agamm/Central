import { useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProjectItem } from "./ProjectItem";
import { EmptyProjectState } from "./EmptyProjectState";
import { useProjectStore } from "../store";

interface ProjectListProps {
  readonly onAddProject: () => void;
}

function ProjectList({ onAddProject }: ProjectListProps) {
  const projects = useProjectStore((s) => s.projects);
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const selectProject = useProjectStore((s) => s.selectProject);
  const renameProject = useProjectStore((s) => s.renameProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);

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
            onSelect={handleSelect}
            onRename={handleRename}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

export { ProjectList };
