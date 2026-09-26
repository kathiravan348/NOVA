import { Controller, type UseFormReturn } from "react-hook-form";
import { DEFAULT_INDEX_NAMES } from "@nova/contracts";
import { Card, Select } from "@nova/ui-core";
import { useInstruments } from "@nova/services";
import { InstrumentTable } from "../../components/InstrumentTable";
import { QueryError } from "../../components/QueryState";
import type { BacktestForm } from "./backtestForm";

/** Symbols card of the run form: a whole index, or symbols picked from the instrument list (R2). */
export function UniverseFields({ form }: { form: UseFormReturn<BacktestForm> }) {
  const { register, control, watch, formState } = form;
  const instruments = useInstruments();
  const universeType = watch("universeType");
  const from = watch("from");
  const to = watch("to");
  const error = formState.errors.symbols?.message;

  return (
    <Card title="Symbols">
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Test on"
            options={[
              { value: "symbols", label: "Chosen symbols" },
              { value: "index", label: "A whole index" },
            ]}
            {...register("universeType")}
          />
          {universeType === "index" && (
            <Select
              label="Index"
              options={DEFAULT_INDEX_NAMES.map((v) => ({ value: v, label: v }))}
              {...register("index")}
            />
          )}
        </div>
        {universeType === "symbols" && (
          <>
            {error && (
              <p role="alert" className="text-body-sm text-loss">
                {error}
              </p>
            )}
            <Controller
              control={control}
              name="symbols"
              render={({ field }) => (
                <InstrumentTable
                  caption="Instruments to test"
                  instruments={instruments.data ?? []}
                  loading={instruments.isPending}
                  error={
                    instruments.isError ? (
                      <QueryError
                        error={instruments.error}
                        onRetry={() => void instruments.refetch()}
                      />
                    ) : undefined
                  }
                  selected={field.value}
                  onSelectedChange={field.onChange}
                  period={from && to ? { from, to } : undefined}
                  pageSize={8}
                />
              )}
            />
          </>
        )}
      </div>
    </Card>
  );
}
