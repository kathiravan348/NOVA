import { useFieldArray, useFormContext } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button, Card, IconButton, Select, type SelectOption } from "@nova/ui-core";
import { emptyCondition, type EditorForm } from "./editorForm";
import { OperandFields } from "./OperandFields";

const combinatorOptions: SelectOption[] = [
  { value: "all", label: "All conditions" },
  { value: "any", label: "Any condition" },
];

const opOptions: SelectOption[] = [
  { value: "crosses_above", label: "crosses above" },
  { value: "crosses_below", label: "crosses below" },
  { value: "gt", label: ">" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "<" },
  { value: "lte", label: "≤" },
  { value: "eq", label: "=" },
];

export interface RuleGroupEditorProps {
  group: "entry" | "exit";
  title: string;
}

export function RuleGroupEditor({ group, title }: RuleGroupEditorProps) {
  const { control, register } = useFormContext<EditorForm>();
  const { fields, append, remove } = useFieldArray({ control, name: `${group}.conditions` });

  return (
    <Card title={title}>
      <div className="flex flex-col gap-4">
        <Select
          label={`${title}: match`}
          options={combinatorOptions}
          containerClassName="md:max-w-xs"
          {...register(`${group}.combinator`)}
        />
        <ol className="flex flex-col gap-3">
          {fields.map((field, index) => {
            const context = `${group} condition ${index + 1}`;
            return (
              <li
                key={field.id}
                className="flex flex-col gap-3 rounded-md border border-border-default p-3 lg:flex-row lg:items-start"
              >
                <OperandFields
                  name={`${group}.conditions.${index}.left`}
                  label="Left"
                  context={context}
                />
                <Select
                  label={
                    <>
                      Operator<span className="sr-only">, {context}</span>
                    </>
                  }
                  options={opOptions}
                  containerClassName="shrink-0 lg:w-40"
                  {...register(`${group}.conditions.${index}.op`)}
                />
                <OperandFields
                  name={`${group}.conditions.${index}.right`}
                  label="Right"
                  context={context}
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
        <Button
          type="button"
          variant="ghost"
          className="self-start"
          onClick={() => append(emptyCondition())}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add condition
        </Button>
      </div>
    </Card>
  );
}
