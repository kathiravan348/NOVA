import { useFormContext } from "react-hook-form";
import { Card, Input, Select, Switch } from "@nova/ui-core";
import type { EditorForm } from "./editorForm";
import { OperandFields } from "./OperandFields";

/** At most N holdings; waiting buys ranked by a price or indicator (D62). */
export function PortfolioFields() {
  const { register, watch, setValue, formState } = useFormContext<EditorForm>();
  const { errors } = formState;
  const limited = watch("maxPositions").trim() !== "";
  const rankOn = watch("rankOn");

  return (
    <Card title="Portfolio">
      <div className="flex flex-col gap-4">
        <Input
          label="Max positions"
          description="The most stocks held at once. Leave empty for no limit."
          inputMode="numeric"
          containerClassName="sm:max-w-xs"
          error={errors.maxPositions?.message}
          {...register("maxPositions")}
        />
        {limited && (
          <Switch
            label="Rank buys"
            description="When more stocks want to be bought than there are free places, buy the best-ranked first."
            checked={rankOn}
            onCheckedChange={(on) =>
              setValue("rankOn", on, { shouldValidate: formState.isSubmitted })
            }
          />
        )}
        {limited && rankOn && (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <OperandFields
              name="rank"
              label="Rank buys by"
              context="rank"
              kinds={["price", "indicator"]}
            />
            <Select
              label="Order"
              options={[
                { value: "desc", label: "Highest first" },
                { value: "asc", label: "Lowest first" },
              ]}
              containerClassName="lg:w-48"
              {...register("rankOrder")}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
