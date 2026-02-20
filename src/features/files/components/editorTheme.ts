import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/**
 * Custom CodeMirror theme matching globals.css dark palette.
 * HSL values from design tokens:
 *   background: hsl(224, 71%, 4%)  -> #060b18
 *   surface:    hsl(224, 71%, 6%)  -> #0a1120
 *   muted:      hsl(223, 47%, 11%) -> #0f1729
 *   border:     hsl(216, 34%, 17%) -> #1d2b3e
 *   foreground: hsl(213, 31%, 91%) -> #dfe6ee
 *   muted-fg:   hsl(215, 20%, 55%) -> #7a8da3
 */
const centralEditorTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "hsl(224, 71%, 4%)",
      color: "hsl(213, 31%, 91%)",
      fontSize: "12px",
      fontFamily:
        '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
    },
    ".cm-content": {
      caretColor: "hsl(213, 31%, 91%)",
      padding: "8px 0",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "hsl(213, 31%, 91%)",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor: "hsl(223, 47%, 18%)",
    },
    ".cm-activeLine": {
      backgroundColor: "hsl(223, 47%, 8%)",
    },
    ".cm-gutters": {
      backgroundColor: "hsl(224, 71%, 4%)",
      color: "hsl(215, 20%, 35%)",
      border: "none",
      borderRight: "1px solid hsl(216, 34%, 17%)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "hsl(223, 47%, 8%)",
      color: "hsl(215, 20%, 55%)",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 8px 0 16px",
      minWidth: "40px",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "hsl(223, 47%, 11%)",
      border: "1px solid hsl(216, 34%, 17%)",
      color: "hsl(215, 20%, 55%)",
    },
    ".cm-tooltip": {
      backgroundColor: "hsl(224, 71%, 6%)",
      border: "1px solid hsl(216, 34%, 17%)",
    },
    ".cm-panels": {
      backgroundColor: "hsl(224, 71%, 6%)",
      color: "hsl(213, 31%, 91%)",
    },
    ".cm-scroller": {
      overflow: "auto",
    },
  },
  { dark: true },
);

const centralHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#c678dd" },
  { tag: tags.operator, color: "#56b6c2" },
  { tag: tags.special(tags.variableName), color: "#e06c75" },
  { tag: tags.typeName, color: "#e5c07b" },
  { tag: tags.atom, color: "#d19a66" },
  { tag: tags.number, color: "#d19a66" },
  { tag: tags.definition(tags.variableName), color: "#61afef" },
  { tag: tags.string, color: "#98c379" },
  { tag: tags.special(tags.string), color: "#56b6c2" },
  { tag: tags.comment, color: "#5c6370", fontStyle: "italic" },
  { tag: tags.variableName, color: "#e06c75" },
  { tag: tags.tagName, color: "#e06c75" },
  { tag: tags.propertyName, color: "#61afef" },
  { tag: tags.attributeName, color: "#d19a66" },
  { tag: tags.className, color: "#e5c07b" },
  { tag: tags.labelName, color: "#e06c75" },
  { tag: tags.namespace, color: "#e5c07b" },
  { tag: tags.macroName, color: "#e06c75" },
  { tag: tags.literal, color: "#56b6c2" },
  { tag: tags.bool, color: "#d19a66" },
  { tag: tags.null, color: "#d19a66" },
  { tag: tags.regexp, color: "#98c379" },
  { tag: tags.escape, color: "#56b6c2" },
  { tag: tags.link, color: "#61afef", textDecoration: "underline" },
  { tag: tags.heading, color: "#e06c75", fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.meta, color: "#5c6370" },
  { tag: tags.processingInstruction, color: "#5c6370" },
  { tag: tags.punctuation, color: "#abb2bf" },
  { tag: tags.bracket, color: "#abb2bf" },
]);

const centralTheme = [
  centralEditorTheme,
  syntaxHighlighting(centralHighlightStyle),
];

export { centralTheme, centralEditorTheme, centralHighlightStyle };
