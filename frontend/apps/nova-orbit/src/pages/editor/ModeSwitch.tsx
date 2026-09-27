import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button, Modal } from "@nova/ui-core";
import { hasModeWork, modeDefaults, type EditorForm, type EditorMode } from "./editorForm";

const modes: { value: EditorMode; label: string }[] = [
  { value: "visual", label: "Visual rules" },
  { value: "python", label: "Python" },
  { value: "rotation", label: "Rotation" },
];

/**
 * Segmented radio group for the authoring mode. Switching keeps the name and description and
 * starts the other settings from that mode's defaults (Python: a template), after a confirm when
 * settings would be lost.
 */
export function ModeSwitch() {
  const { watch, getValues, reset } = useFormContext<EditorForm>();
  const mode = watch("mode");
  const [asking, setAsking] = useState<EditorMode | null>(null);

  const switchTo = (next: EditorMode) => {
    const { name, description } = getValues();
    reset({ ...modeDefaults(next), name, description }, { keepDefaultValues: true });
    setAsking(null);
  };

  const choose = (next: EditorMode) => {
    if (next === mode) return;
    if (hasModeWork(getValues())) setAsking(next);
    else switchTo(next);
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-label text-text-muted">Authoring mode</legend>
      <div className="inline-flex w-fit flex-wrap rounded-md border border-border-default bg-bg-raised p-1">
        {modes.map((option) => (
          <label key={option.value} className="cursor-pointer">
            <input
              type="radio"
              name="mode"
              value={option.value}
              className="peer sr-only"
              checked={mode === option.value}
              onChange={() => choose(option.value)}
            />
            <span className="block rounded-sm px-4 py-1.5 text-body-sm text-text-secondary peer-checked:bg-action-subtle peer-checked:font-medium peer-checked:text-text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-action">
              {option.label}
            </span>
          </label>
        ))}
      </div>
      <Modal
        open={asking !== null}
        onOpenChange={(open) => !open && setAsking(null)}
        title={`Switch to ${modes.find((m) => m.value === asking)?.label ?? ""}?`}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setAsking(null)}>
              Keep editing
            </Button>
            <Button type="button" onClick={() => asking && switchTo(asking)}>
              Switch
            </Button>
          </>
        }
      >
        <p className="text-body text-text-secondary">
          The settings below start again from that mode&apos;s defaults. The name and description
          stay.
        </p>
      </Modal>
    </fieldset>
  );
}
