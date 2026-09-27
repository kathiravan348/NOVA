import { useFormContext } from "react-hook-form";
import { Card, Input, Switch } from "@nova/ui-core";
import type { EditorForm } from "./editorForm";

/** Trailing stop, ATR stop and exit after N bars (D62); all optional. */
export function ExitsFields() {
  const { register, watch, setValue, formState } = useFormContext<EditorForm>();
  const { errors } = formState;
  const atrOn = watch("atrOn");

  return (
    <Card title="Exits">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Trailing stop"
          description="Sells if the price falls this % below its highest close since buying."
          inputMode="decimal"
          trailing="%"
          error={errors.trailingStopPercent?.message}
          {...register("trailingStopPercent")}
        />
        <Input
          label="Exit after N bars"
          description="Sells at the next open once the stock has been held this many candles."
          inputMode="numeric"
          error={errors.maxHoldBars?.message}
          {...register("maxHoldBars")}
        />
        <Switch
          label="ATR stop"
          description="Sells if the price falls a number of ATRs (the average daily range) below its highest close since buying."
          containerClassName="sm:col-span-2"
          checked={atrOn}
          onCheckedChange={(on) => setValue("atrOn", on, { shouldValidate: formState.isSubmitted })}
        />
        {atrOn && (
          <Input
            label="Period"
            inputMode="numeric"
            error={errors.atrPeriod?.message}
            {...register("atrPeriod")}
          />
        )}
        {atrOn && (
          <Input
            label="× ATR"
            inputMode="decimal"
            error={errors.atrMultiplier?.message}
            {...register("atrMultiplier")}
          />
        )}
      </div>
    </Card>
  );
}
