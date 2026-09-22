import { Controller, useFormContext } from "react-hook-form";
import { Card, CodeEditor } from "@nova/ui-core";
import type { EditorForm } from "./editorForm";

export function PythonFields() {
  const { control } = useFormContext<EditorForm>();
  return (
    <Card title="Code">
      <Controller
        control={control}
        name="code"
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-2">
            <CodeEditor value={field.value} onChange={field.onChange} ariaLabel="Strategy code" />
            {fieldState.error && (
              <p role="alert" className="text-body-sm text-loss-text">
                {fieldState.error.message}
              </p>
            )}
            <p className="text-body-sm text-text-muted">
              Runs in a sandbox in Stage B. Not executed in this prototype.
            </p>
          </div>
        )}
      />
    </Card>
  );
}
