import { useRef, useEffect } from "react";
import { EditorView, lineNumbers } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { Compartment } from "@codemirror/state";
import { X } from "lucide-react";
import { centralTheme } from "./editorTheme";
import { loadLanguage } from "./languageSupport";
import { useFilesStore } from "../store";

interface FileViewerProps {
  readonly content: string;
  readonly filePath: string;
}

const languageCompartment = new Compartment();

function createEditorState(content: string): EditorState {
  return EditorState.create({
    doc: content,
    extensions: [
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      lineNumbers(),
      centralTheme,
      languageCompartment.of([]),
      EditorView.lineWrapping,
    ],
  });
}

function FileViewer({ content, filePath }: FileViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const state = createEditorState(content);
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
      <FileViewerHeader filePath={filePath} />
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
}

function FileViewerHeader({ filePath }: FileViewerHeaderProps) {
  const fileName = filePath.split("/").pop() ?? filePath;
  const closeFileViewer = useFilesStore((s) => s.closeFileViewer);

  return (
    <div className="flex items-center border-b border-border px-3 py-1">
      <span className="truncate text-xs text-muted-foreground">{fileName}</span>
      <span className="ml-2 truncate text-[10px] text-muted-foreground/50">
        {filePath}
      </span>
      <button
        type="button"
        className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={closeFileViewer}
        title="Close file viewer"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export { FileViewer };
