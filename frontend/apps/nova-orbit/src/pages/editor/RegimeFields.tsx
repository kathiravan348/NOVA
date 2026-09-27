import { useFormContext } from "react-hook-form";
import { Card, Select, Switch, type SelectOption } from "@nova/ui-core";
import type { MarketIndex } from "@nova/contracts";
import { useMarketIndices } from "@nova/services";
import type { EditorForm } from "./editorForm";
import { OperandFields } from "./OperandFields";

const opOptions: SelectOption[] = [
  { value: "crosses_above", label: "crosses above" },
  { value: "crosses_below", label: "crosses below" },
  { value: "gt", label: ">" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "<" },
  { value: "lte", label: "≤" },
  { value: "eq", label: "=" },
];

/** The indices list, keeping a saved index that is not (or not yet) in it. */
function indexOptions(known: MarketIndex[] | undefined, current: string): SelectOption[] {
  const options = (known ?? []).map((i) => ({ value: i.name, label: i.name }));
  return options.some((o) => o.value === current) || !current
    ? options
    : [{ value: current, label: current }, ...options];
}

/** Market filter (D62): one condition on an index's own prices, e.g. NIFTY 50 above SMA(200). */
export function RegimeFields() {
  const { register, watch, setValue, formState } = useFormContext<EditorForm>();
  const indices = useMarketIndices();
  const on = watch("regimeOn");

  return (
    <Card title="Market filter">
      <div className="flex flex-col gap-4">
        <Switch
          label="Use a market filter"
          description="Trade only while the market is healthy: a rule on an index's own prices, such as NIFTY 50 above its 200-day average."
          checked={on}
          onCheckedChange={(value) =>
            setValue("regimeOn", value, { shouldValidate: formState.isSubmitted })
          }
        />
        {on && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Index"
              options={indexOptions(indices.data, watch("regimeIndex"))}
              disabled={indices.isPending}
              error={
                formState.errors.regimeIndex?.message ??
                (indices.isError ? "Could not load the indices" : undefined)
              }
              {...register("regimeIndex")}
            />
            <Select
              label="When the filter fails"
              options={[
                { value: "no_new_entries", label: "No new buys" },
                { value: "exit_all", label: "Sell everything" },
              ]}
              {...register("regimeWhenOff")}
            />
          </div>
        )}
        {on && (
          <div className="flex flex-col gap-3 rounded-md border border-border-default p-3 lg:flex-row lg:items-start">
            <OperandFields name="regime.left" label="Left" context="market filter" />
            <Select
              label={
                <>
                  Operator<span className="sr-only">, market filter</span>
                </>
              }
              options={opOptions}
              containerClassName="shrink-0 lg:w-40"
              {...register("regime.op")}
            />
            <OperandFields name="regime.right" label="Right" context="market filter" />
          </div>
        )}
      </div>
    </Card>
  );
}
