import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Select } from "@nova/ui-core";
import { useMarketIndices } from "@nova/services";
import type { BacktestForm } from "./backtestForm";
import { indexOptions } from "./UniverseFields";

/**
 * **Benchmark**: None or any stored index (D72). While the user has not changed it, testing on a
 * whole index makes that index the benchmark. `locked`: an edited run or a link that names a
 * benchmark keeps its value.
 */
export function BenchmarkField({
  form,
  locked,
}: {
  form: UseFormReturn<BacktestForm>;
  locked: boolean;
}) {
  const indices = useMarketIndices();
  const { register, watch, resetField, formState } = form;
  const universeType = watch("universeType");
  const index = watch("index");
  const changed = formState.dirtyFields.benchmark;
  useEffect(() => {
    if (locked || changed) return;
    // A new default, not a user change: the field stays clean and keeps following.
    if (universeType === "index") resetField("benchmark", { defaultValue: index });
  }, [locked, changed, universeType, index, resetField]);

  return (
    <Select
      label="Benchmark"
      options={[{ value: "", label: "None" }, ...indexOptions(indices.data, watch("benchmark"))]}
      disabled={indices.isPending}
      error={indices.isError ? "Could not load the indices" : formState.errors.benchmark?.message}
      {...register("benchmark")}
    />
  );
}
