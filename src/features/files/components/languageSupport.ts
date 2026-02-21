import type { Extension } from "@codemirror/state";

/** File extension to language loader mapping */
type LanguageLoader = () => Promise<Extension>;

const languageMap: Record<string, LanguageLoader> = {
  js: () => import("@codemirror/lang-javascript").then((m) => m.javascript()),
  jsx: () =>
    import("@codemirror/lang-javascript").then((m) =>
      m.javascript({ jsx: true }),
    ),
  ts: () =>
    import("@codemirror/lang-javascript").then((m) =>
      m.javascript({ typescript: true }),
    ),
  tsx: () =>
    import("@codemirror/lang-javascript").then((m) =>
      m.javascript({ jsx: true, typescript: true }),
    ),
  mjs: () => import("@codemirror/lang-javascript").then((m) => m.javascript()),
  cjs: () => import("@codemirror/lang-javascript").then((m) => m.javascript()),
  rs: () => import("@codemirror/lang-rust").then((m) => m.rust()),
  css: () => import("@codemirror/lang-css").then((m) => m.css()),
  scss: () => import("@codemirror/lang-css").then((m) => m.css()),
  html: () => import("@codemirror/lang-html").then((m) => m.html()),
  htm: () => import("@codemirror/lang-html").then((m) => m.html()),
  json: () => import("@codemirror/lang-json").then((m) => m.json()),
  md: () => import("@codemirror/lang-markdown").then((m) => m.markdown()),
  markdown: () => import("@codemirror/lang-markdown").then((m) => m.markdown()),
  py: () => import("@codemirror/lang-python").then((m) => m.python()),
  toml: () => import("@codemirror/lang-json").then((m) => m.json()),
  yaml: () => import("@codemirror/lang-json").then((m) => m.json()),
  yml: () => import("@codemirror/lang-json").then((m) => m.json()),
};

function getExtension(filePath: string): string {
  const parts = filePath.split(".");
  return parts.length > 1 ? (parts[parts.length - 1] ?? "") : "";
}

async function loadLanguage(filePath: string): Promise<Extension | null> {
  const ext = getExtension(filePath).toLowerCase();
  const loader = languageMap[ext];
  if (!loader) return null;
  try {
    return await loader();
  } catch {
    return null;
  }
}

export { loadLanguage, getExtension };
