import { useFieldArray, useFormContext } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button, IconButton, Input } from "@nova/ui-core";
import type { EditorForm } from "./editorForm";
import { MAX_TERMS, rocTerm } from "./editorFormRotation";
import { OperandFields } from "./OperandFields";

/** 1–3 weighted terms added up into each stock's score (D62 (4)). */
export function ScoreTermsEditor() {
  const { control, register, formState } = useFormContext<EditorForm>();
  const { fields, append, remove } = useFieldArray({ control, name: "scoreTerms" });
  const errors = formState.errors.scoreTerms;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-label text-text-primary">Score</h3>
        <p className="text-body-sm text-text-muted">Stocks with the highest score are held.</p>
      </div>
      <ol className="flex flex-col gap-3">
        {fields.map((field, index) => {
          const context = `score term ${index + 1}`;
          return (
            <li
              key={field.id}
              className="flex flex-col gap-3 rounded-md border border-border-default p-3 lg:flex-row lg:items-start"
            >
              <OperandFields
                name={`scoreTerms.${index}.operand`}
                label="Term"
                context={context}
                kinds={["price", "indicator"]}
              />
              <Input
                label={
                  <>
                    Weight<span className="sr-only">, {context}</span>
                  </>
                }
                inputMode="decimal"
                containerClassName="lg:w-32"
                error={errors?.[index]?.weight?.message}
                {...register(`scoreTerms.${index}.weight`)}
              />
              <IconButton
                variant="ghost"
                size="sm"
                className="self-end lg:mt-7 lg:self-start"
                aria-label={`Remove ${context}`}
                icon={<Trash2 className="h-4 w-4" />}
                disabled={fields.length === 1}
                onClick={() => remove(index)}
              />
            </li>
          );
        })}
      </ol>
      {(errors?.root?.message ?? errors?.message) && (
        <p role="alert" className="text-body-sm text-loss-text">
          {errors?.root?.message ?? errors?.message}
        </p>
      )}
      <Button
        type="button"
        variant="ghost"
        className="self-start"
        disabled={fields.length >= MAX_TERMS}
        onClick={() => append(rocTerm())}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add term
      </Button>
    </div>
  );
}
