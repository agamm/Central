import { useRef, useEffect, useState, useCallback } from "react";
import { EditorView, lineNumbers, keymap } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { X, Save } from "lucide-react";
import { centralTheme } from "./editorTheme";
import { loadLanguage } from "./languageSupport";
import { useFilesStore } from "../store";
import { useProjectStore } from "@/features/projects/store";
import * as filesApi from "../api";

interface FileViewerProps {
  readonly content: string;
  readonly filePath: string;
}

const languageCompartment = new Compartment();

function createEditorState(
  content: string,
  onUpdate: (content: string) => void,
  onSave: () => boolean,
): EditorState {
  return EditorState.create({
    doc: content,
    extensions: [
      lineNumbers(),
      centralTheme,
      languageCompartment.of([]),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onUpdate(update.state.doc.toString());
        }
      }),
      keymap.of([{ key: "Mod-s", run: () => onSave() }]),
    ],
  });
}

/** Mutable container shared between CodeMirror callbacks and React.
 *  All mutations happen inside event handlers or effects -- never during render. */
interface EditorContext {
  originalContent: string;
  currentContent: string;
  save: () => Promise<void>;
}

function FileViewer({ content, filePath }: FileViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const ctxRef = useRef<EditorContext>({
    originalContent: content,
    currentContent: content,
    save: async () => {},
  });

  // Track dirty state as an explicit version counter that resets on prop change.
  // dirtyVersion > 0 means dirty; reset to 0 when content/filePath changes.
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  // Track the content prop so we can reset dirty when it changes
  const [trackedContent, setTrackedContent] = useState(content);

  // When the content prop changes (new file opened), reset dirty state
  const contentChanged = trackedContent !== content;
  if (contentChanged) {
    setTrackedContent(content);
    setIsDirty(false);
  }

  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const projects = useProjectStore((s) => s.projects);
  const projectPath = projects.find((p) => p.id === selectedProjectId)?.path;

  const handleSave = useCallback(async () => {
    const ctx = ctxRef.current;
    if (!projectPath || !isDirty || saving) return;
    setSaving(true);
    const result = await filesApi.writeFile(
      projectPath,
      filePath,
      ctx.currentContent,
    );
    result.match(
      () => {
        ctx.originalContent = ctx.currentContent;
        setIsDirty(false);
      },
      (error) => {
        // TODO: surface error to user via toast/notification
        console.error(error);
      },
    );
    setSaving(false);
  }, [projectPath, filePath, isDirty, saving]);

  // Keep the context save function up to date
  useEffect(() => {
    ctxRef.current.save = handleSave;
  }, [handleSave]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Reset context for the new file
    const ctx = ctxRef.current;
    ctx.originalContent = content;
    ctx.currentContent = content;

    const onUpdate = (newContent: string) => {
      ctx.currentContent = newContent;
      setIsDirty(newContent !== ctx.originalContent);
    };

    const onSave = (): boolean => {
      void ctx.save();
      return true;
    };

    const state = createEditorState(content, onUpdate, onSave);
    const view = new EditorView({ state, parent: container });
    viewRef.current = view;

    void loadLanguage(filePath).then((lang) => {
      if (lang && viewRef.current) {
        viewRef.current.dispatch({
          effects: languageCompartment.reconfigure(lang),
        });
      }
    });

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [content, filePath]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <FileViewerHeader
        filePath={filePath}
        isDirty={isDirty}
        saving={saving}
        onSave={() => void handleSave()}
      />
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
        style={{ height: "calc(100% - 28px)" }}
      />
    </div>
  );
}

interface FileViewerHeaderProps {
  readonly filePath: string;
  readonly isDirty: boolean;
  readonly saving: boolean;
  readonly onSave: () => void;
}

function FileViewerHeader({
  filePath,
  isDirty,
  saving,
  onSave,
}: FileViewerHeaderProps) {
  const fileName = filePath.split("/").pop() ?? filePath;
  const closeFileViewer = useFilesStore((s) => s.closeFileViewer);

  return (
    <div className="flex items-center border-b border-border px-3 py-1">
      <span className="truncate text-xs text-muted-foreground">
        {fileName}
      </span>
      {isDirty && (
        <span
          className="ml-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-400"
          title="Unsaved changes"
        />
      )}
      <span className="ml-2 truncate text-[10px] text-muted-foreground/50">
        {filePath}
      </span>
      <div className="ml-auto flex items-center gap-1">
        {isDirty && (
          <button
            type="button"
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            onClick={onSave}
            disabled={saving}
            title="Save file (Cmd+S)"
          >
            <Save className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={closeFileViewer}
          title="Close file viewer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export { FileViewer };
