import { useFormContext } from "react-hook-form";
import { Card, Input, Select, type SelectOption } from "@nova/ui-core";
import { segmentLabel, timeframeLabel } from "../../lib/format";
import type { EditorForm } from "./editorForm";

const toOptions = (labels: Record<string, string>): SelectOption[] =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

export function BasicsFields() {
  const { register, watch, formState } = useFormContext<EditorForm>();
  const { errors } = formState;
  const sizingType = watch("sizingType");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Basics">
        <div className="flex flex-col gap-4">
          <Input label="Name" required error={errors.name?.message} {...register("name")} />
          <Input label="Description" {...register("description")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Segment"
              options={toOptions(segmentLabel)}
              containerClassName="sm:col-span-2"
              {...register("segment")}
            />
            <Select
              label="Exchange"
              options={[
                { value: "NSE", label: "NSE" },
                { value: "NFO", label: "NFO" },
              ]}
              {...register("exchange")}
            />
            <Select
              label="Timeframe"
              options={toOptions(timeframeLabel)}
              {...register("timeframe")}
            />
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-6">
        <Card title="Sizing and risk">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Sizing"
              options={[
                { value: "fixed_qty", label: "Fixed quantity" },
                { value: "fixed_amount", label: "Fixed amount" },
                { value: "percent_equity", label: "% of equity" },
              ]}
              {...register("sizingType")}
            />
            {sizingType === "fixed_qty" && (
              <Input
                label="Quantity"
                inputMode="numeric"
                error={errors.qty?.message}
                {...register("qty")}
              />
            )}
            {sizingType === "fixed_amount" && (
              <Input
                label="Amount"
                inputMode="decimal"
                leading="₹"
                error={errors.amountRupees?.message}
                {...register("amountRupees")}
              />
            )}
            {sizingType === "percent_equity" && (
              <Input
                label="Percent"
                inputMode="decimal"
                trailing="%"
                error={errors.percent?.message}
                {...register("percent")}
              />
            )}
            <Input
              label="Stop-loss"
              inputMode="decimal"
              trailing="%"
              error={errors.stopLossPercent?.message}
              {...register("stopLossPercent")}
            />
            <Input
              label="Target"
              inputMode="decimal"
              trailing="%"
              error={errors.targetPercent?.message}
              {...register("targetPercent")}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
