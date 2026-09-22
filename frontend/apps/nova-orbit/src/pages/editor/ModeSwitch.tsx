import { useFormContext } from "react-hook-form";
import { PYTHON_TEMPLATE, type EditorForm } from "./editorForm";

const modes = [
  { value: "visual", label: "Visual rules" },
  { value: "python", label: "Python" },
] as const;

/** Segmented radio group for the authoring mode; Python starts from a template. */
export function ModeSwitch() {
  const { register, getValues, setValue } = useFormContext<EditorForm>();
  const field = register("mode");

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-label text-text-muted">Authoring mode</legend>
      <div className="inline-flex w-fit rounded-md border border-border-default bg-bg-raised p-1">
        {modes.map((mode) => (
          <label key={mode.value} className="cursor-pointer">
            <input
              type="radio"
              value={mode.value}
              className="peer sr-only"
              {...field}
              onChange={(e) => {
                void field.onChange(e);
                if (e.target.value === "python" && getValues("code").trim() === "") {
                  setValue("code", PYTHON_TEMPLATE);
                }
              }}
            />
            <span className="block rounded-sm px-4 py-1.5 text-body-sm text-text-secondary peer-checked:bg-action-subtle peer-checked:font-medium peer-checked:text-text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-action">
              {mode.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
