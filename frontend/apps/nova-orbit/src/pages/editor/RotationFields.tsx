import { useFormContext } from "react-hook-form";
import { Card, Input, Select, Switch } from "@nova/ui-core";
import type { EditorForm } from "./editorForm";
import { RuleGroupEditor } from "./RuleGroupEditor";
import { ScoreTermsEditor } from "./ScoreTermsEditor";

/** Rotation settings (D62 (4)): when to rebalance, how many to hold, the score and a filter. */
export function RotationFields() {
  const { register, watch, setValue, formState } = useFormContext<EditorForm>();
  const { errors } = formState;
  const filterOn = watch("filterOn");

  return (
    <div className="flex flex-col gap-6">
      <Card title="Rotation">
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label="Rebalance"
              options={[
                { value: "weekly", label: "Every week" },
                { value: "monthly", label: "Every month" },
                { value: "quarterly", label: "Every quarter" },
              ]}
              {...register("rebalance")}
            />
            <Input
              label="Hold"
              description="How many stocks to own."
              inputMode="numeric"
              error={errors.hold?.message}
              {...register("hold")}
            />
            <Input
              label="Keep while in top"
              description="A holding is sold only when it falls below this rank."
              inputMode="numeric"
              error={errors.keepWithin?.message}
              {...register("keepWithin")}
            />
          </div>
          <ScoreTermsEditor />
          <Switch
            label="Only stocks where…"
            description="Rank only the stocks that pass these rules; a holding that fails them is sold at the next rebalance."
            checked={filterOn}
            onCheckedChange={(on) =>
              setValue("filterOn", on, { shouldValidate: formState.isSubmitted })
            }
          />
        </div>
      </Card>
      {filterOn && <RuleGroupEditor group="filter" title="Only stocks where…" />}
    </div>
  );
}
