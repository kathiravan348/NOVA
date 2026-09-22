import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

/** CodeMirror theme built only from NOVA Style tokens, so dark/light follow `data-theme`. */
export const codeTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--bg-surface)",
    color: "var(--text-primary)",
    fontSize: "13px",
    borderRadius: "var(--radius-md)",
  },
  "&.cm-focused": {
    outline: "2px solid var(--action)",
    outlineOffset: "2px",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    lineHeight: "1.6",
  },
  ".cm-content": {
    caretColor: "var(--action)",
    padding: "8px 0",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--action)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "var(--action-subtle)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--bg-raised)",
    color: "var(--text-muted)",
    borderRight: "1px solid var(--border-default)",
  },
  ".cm-activeLine": {
    backgroundColor: "transparent",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--bg-surface)",
    color: "var(--text-secondary)",
  },
});

export const codeHighlight = syntaxHighlighting(
  HighlightStyle.define([
    {
      tag: [tags.keyword, tags.controlKeyword, tags.definitionKeyword],
      color: "var(--action-text)",
    },
    { tag: [tags.string, tags.special(tags.string)], color: "var(--profit-text)" },
    { tag: [tags.number, tags.bool, tags.null], color: "var(--warning-text)" },
    { tag: [tags.comment, tags.lineComment], color: "var(--text-muted)", fontStyle: "italic" },
    {
      tag: [tags.function(tags.variableName), tags.definition(tags.variableName)],
      color: "var(--text-primary)",
      fontWeight: "600",
    },
    { tag: [tags.operator, tags.punctuation], color: "var(--text-secondary)" },
  ]),
);
