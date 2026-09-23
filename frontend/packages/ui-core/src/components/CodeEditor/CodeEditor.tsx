import * as React from "react";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { cn } from "../../lib/cn";
import { codeHighlight, codeTheme } from "./codeTheme";

export interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  ariaLabel: string;
  /** Minimum editor height in px. */
  minHeight?: number;
  className?: string;
}

/** Python code editor (CodeMirror 6, D24). Uncontrolled inside; `value` changes are synced in. */
export function CodeEditor({
  value,
  onChange,
  readOnly = false,
  ariaLabel,
  minHeight = 240,
  className,
}: CodeEditorProps): React.ReactElement {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const viewRef = React.useRef<EditorView | null>(null);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          python(),
          codeTheme,
          codeHighlight,
          EditorView.lineWrapping,
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly),
          EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
          EditorView.theme({ ".cm-content, .cm-gutter": { minHeight: `${minHeight}px` } }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current?.(update.state.doc.toString());
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // The view is created once per readOnly/label/height; `value` is synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, ariaLabel, minHeight]);

  React.useEffect(() => {
    const view = viewRef.current;
    if (view && view.state.doc.toString() !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }
  }, [value]);

  return (
    <div
      ref={hostRef}
      data-testid="code-editor"
      className={cn("min-w-0 overflow-hidden rounded-md border border-border-default", className)}
    />
  );
}
