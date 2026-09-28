import type { ReactElement } from "react";

export interface TextBlockProps {
  text: string;
  label: string;
}

/** Full plain text with wrapping and keyboard-accessible scrolling. */
export function TextBlock({ text, label }: TextBlockProps): ReactElement {
  return (
    <textarea
      aria-label={label}
      readOnly
      rows={Math.min(12, Math.max(2, text.split("\n").length))}
      value={text || "No content"}
      className="w-full max-h-64 resize-none overflow-auto whitespace-pre-wrap break-all rounded-lg border border-border-default bg-bg-ground p-4 font-mono text-body-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
    />
  );
}
