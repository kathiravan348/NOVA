import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { StrategySpec } from "@nova/contracts";
import { Select } from "@nova/ui-core";
import { dataSourceLabel } from "../../lib/format";
import { isSecondsTimeframe, sourceProblem, type BacktestForm } from "./backtestForm";

const RECORDED_HINT =
  "Candles built from your recorded ticks (from 1 Oct 2026). Intraday only. Buys fill at the ask, " +
  "sells at the bid. Days with feed gaps over 5 minutes are skipped.";
const HISTORY_HINT = "Zerodha's 1-minute and daily candles you downloaded.";

/**
 * **Data** (D82): History data or Recorded data. While the user has not changed it, a strategy on
 * seconds candles starts on Recorded data (seconds exist only there). `locked`: an edited run keeps
 * its source unless the user changes it.
 */
export function DataSourceField({
  form,
  spec,
  locked,
}: {
  form: UseFormReturn<BacktestForm>;
  spec: StrategySpec | undefined;
  locked: boolean;
}) {
  const { register, watch, resetField, formState } = form;
  const changed = formState.dirtyFields.dataSource;
  const seconds = spec !== undefined && isSecondsTimeframe(spec.timeframe);
  useEffect(() => {
    if (locked || changed) return;
    resetField("dataSource", { defaultValue: seconds ? "recorded" : "history" });
  }, [locked, changed, seconds, resetField]);

  const source = watch("dataSource");
  const problem = spec ? sourceProblem(spec, source) : null;
  return (
    <Select
      label="Data"
      options={(["history", "recorded"] as const).map((value) => ({
        value,
        label: dataSourceLabel[value],
      }))}
      description={source === "recorded" ? RECORDED_HINT : HISTORY_HINT}
      error={problem ?? formState.errors.dataSource?.message}
      {...register("dataSource")}
    />
  );
}
