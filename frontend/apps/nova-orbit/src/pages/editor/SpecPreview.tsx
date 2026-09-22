import { useFormContext } from "react-hook-form";
import { Card } from "@nova/ui-core";
import { EditorFormSchema, toSpec, type EditorForm } from "./editorForm";

/** Live JSON of the Strategy Spec the form would save. */
export function SpecPreview() {
  const { watch } = useFormContext<EditorForm>();
  const parsed = EditorFormSchema.safeParse(watch());

  return (
    <Card title="Spec preview (JSON)">
      {parsed.success ? (
        <pre
          aria-label="Strategy spec JSON"
          className="max-h-96 overflow-auto rounded-md bg-bg-surface p-3 font-mono text-body-sm text-text-secondary"
        >
          {JSON.stringify(toSpec(parsed.data), null, 2)}
        </pre>
      ) : (
        <p className="text-body-sm text-text-muted">Complete the form to see the spec.</p>
      )}
    </Card>
  );
}
