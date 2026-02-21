import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/**
 * Custom CodeMirror theme matching globals.css dark palette.
 * Neutral, desaturated HSL values (hue=0, saturation=0%):
 *   background: hsl(0, 0%, 5%)   — matches --background
 *   surface:    hsl(0, 0%, 7%)   — matches --card
 *   muted:      hsl(0, 0%, 10%)  — matches --muted
 *   border:     hsl(0, 0%, 13%)  — matches --border
 *   foreground: hsl(0, 0%, 87%)  — matches --foreground
 *   muted-fg:   hsl(0, 0%, 48%) — matches --muted-foreground
 */
const centralEditorTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "hsl(0, 0%, 5%)",
      color: "hsl(0, 0%, 87%)",
      fontSize: "12px",
      fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
    },
    ".cm-content": {
      caretColor: "hsl(0, 0%, 87%)",
      padding: "8px 0",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "hsl(0, 0%, 87%)",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor: "hsl(0, 0%, 18%)",
    },
    ".cm-activeLine": {
      backgroundColor: "hsl(0, 0%, 8%)",
    },
    ".cm-gutters": {
      backgroundColor: "hsl(0, 0%, 5%)",
      color: "hsl(0, 0%, 30%)",
      border: "none",
      borderRight: "1px solid hsl(0, 0%, 13%)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "hsl(0, 0%, 8%)",
      color: "hsl(0, 0%, 48%)",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 8px 0 16px",
      minWidth: "40px",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "hsl(0, 0%, 10%)",
      border: "1px solid hsl(0, 0%, 13%)",
      color: "hsl(0, 0%, 48%)",
    },
    ".cm-tooltip": {
      backgroundColor: "hsl(0, 0%, 7%)",
      border: "1px solid hsl(0, 0%, 13%)",
    },
    ".cm-panels": {
      backgroundColor: "hsl(0, 0%, 7%)",
      color: "hsl(0, 0%, 87%)",
    },
    ".cm-scroller": {
      overflow: "auto",
    },
  },
  { dark: true },
);

const centralHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#c678dd" },
  { tag: tags.operator, color: "#b5a58a" },
  { tag: tags.special(tags.variableName), color: "#e06c75" },
  { tag: tags.typeName, color: "#e5c07b" },
  { tag: tags.atom, color: "#d19a66" },
  { tag: tags.number, color: "#d19a66" },
  { tag: tags.definition(tags.variableName), color: "#d4a276" },
  { tag: tags.string, color: "#98c379" },
  { tag: tags.special(tags.string), color: "#b5a58a" },
  { tag: tags.comment, color: "#5c6370", fontStyle: "italic" },
  { tag: tags.variableName, color: "#e06c75" },
  { tag: tags.tagName, color: "#e06c75" },
  { tag: tags.propertyName, color: "#d4a276" },
  { tag: tags.attributeName, color: "#d19a66" },
  { tag: tags.className, color: "#e5c07b" },
  { tag: tags.labelName, color: "#e06c75" },
  { tag: tags.namespace, color: "#e5c07b" },
  { tag: tags.macroName, color: "#e06c75" },
  { tag: tags.literal, color: "#b5a58a" },
  { tag: tags.bool, color: "#d19a66" },
  { tag: tags.null, color: "#d19a66" },
  { tag: tags.regexp, color: "#98c379" },
  { tag: tags.escape, color: "#b5a58a" },
  { tag: tags.link, color: "#d4a276", textDecoration: "underline" },
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
