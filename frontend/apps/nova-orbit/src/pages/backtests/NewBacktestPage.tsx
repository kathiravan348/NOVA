import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useSearchParams } from "react-router";
import type { Strategy } from "@nova/contracts";
import {
  Button,
  Card,
  DateTimePicker,
  Input,
  Modal,
  Select,
  Skeleton,
  Switch,
  useToast,
} from "@nova/ui-core";
import { useInstruments, useStrategies } from "@nova/services";
import { coversPeriod } from "../../components/InstrumentTable";
import { QueryError } from "../../components/QueryState";
import { BacktestFormSchema, defaultsFor, todayIst, type BacktestForm } from "./backtestForm";
import { UniverseFields } from "./UniverseFields";

function BacktestFormView({
  strategies,
  preselected,
  latestData,
}: {
  strategies: Strategy[];
  preselected?: Strategy;
  latestData?: string;
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const instruments = useInstruments();
  const [uncovered, setUncovered] = useState<string[]>([]);
  const form = useForm<BacktestForm>({
    resolver: zodResolver(BacktestFormSchema),
    defaultValues: defaultsFor(preselected, todayIst(), latestData),
  });
  const { register, control, handleSubmit, watch, setValue, setError, formState } = form;
  const { errors } = formState;
  const strategyId = watch("strategyId");
  const strategy = strategies.find((s) => s.id === strategyId);

  // A new strategy starts on its latest version and a matching name.
  useEffect(() => {
    if (!strategy || !formState.dirtyFields.strategyId) return;
    setValue("version", String(strategy.latestVersion));
    setValue("name", `${strategy.name} backtest`);
  }, [strategy, formState.dirtyFields.strategyId, setValue]);

  const queue = () => {
    toast.show({
      title: "Backtest queued (demo)",
      description: "Nothing runs in Stage A.",
      tone: "success",
    });
    navigate("/backtests");
  };

  // Symbols whose data does not cover the period must be dropped before queueing (R2).
  const onValid = (values: BacktestForm) => {
    if (values.universeType === "symbols") {
      const period = { from: values.from, to: values.to };
      const missing = values.symbols.filter((symbol) => {
        const instrument = instruments.data?.find((i) => i.symbol === symbol);
        return !instrument || !coversPeriod(instrument, period);
      });
      if (missing.length > 0) {
        setUncovered(missing);
        return;
      }
    }
    queue();
  };

  const dropAndQueue = () => {
    const remaining = form.getValues("symbols").filter((s) => !uncovered.includes(s));
    setUncovered([]);
    setValue("symbols", remaining);
    if (remaining.length === 0) {
      setError("symbols", { message: "None of the chosen symbols has data for this period" });
      return;
    }
    queue();
  };

  const versions = [...(strategy?.versions ?? [])].sort((a, b) => b.version - a.version);

  return (
    <form onSubmit={handleSubmit(onValid)} noValidate className="flex max-w-5xl flex-col gap-6">
      <Card title="Strategy">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Strategy"
            placeholder="Choose a strategy"
            options={strategies.map((s) => ({ value: s.id, label: s.name }))}
            error={errors.strategyId?.message}
            {...register("strategyId")}
          />
          <Select
            label="Version"
            placeholder="Choose a version"
            options={versions.map((v) => ({
              value: String(v.version),
              label: `v${v.version} · ${v.note}`,
            }))}
            error={errors.version?.message}
            {...register("version")}
          />
          <Input
            label="Run name"
            containerClassName="sm:col-span-2"
            error={errors.name?.message}
            {...register("name")}
          />
        </div>
      </Card>
      <Card title="Period and capital">
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="from"
            render={({ field }) => (
              <DateTimePicker
                mode="date"
                label="From"
                max={todayIst()}
                value={field.value}
                onChange={(v) => field.onChange(v ?? "")}
                onBlur={field.onBlur}
                error={errors.from?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="to"
            render={({ field }) => (
              <DateTimePicker
                mode="date"
                label="To"
                max={todayIst()}
                value={field.value}
                onChange={(v) => field.onChange(v ?? "")}
                onBlur={field.onBlur}
                error={errors.to?.message}
              />
            )}
          />
          <Input
            label="Initial capital"
            leading="₹"
            inputMode="numeric"
            error={errors.capitalRupees?.message}
            {...register("capitalRupees")}
          />
          <Controller
            control={control}
            name="benchmark"
            render={({ field }) => (
              <Switch
                label="Compare with NIFTY 50"
                checked={field.value}
                onCheckedChange={field.onChange}
                containerClassName="sm:self-end sm:pb-2"
              />
            )}
          />
        </div>
      </Card>
      <UniverseFields form={form} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit">Queue backtest</Button>
        <Button asChild variant="secondary">
          <Link to="/backtests">Cancel</Link>
        </Button>
      </div>
      <Modal
        open={uncovered.length > 0}
        onOpenChange={(open) => !open && setUncovered([])}
        title="Some symbols have no data for this period"
        description="A backtest needs data for the whole period. Drop these symbols and queue?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setUncovered([])}>
              Go back
            </Button>
            <Button onClick={dropAndQueue}>Drop and queue</Button>
          </>
        }
      >
        <p className="font-mono text-body text-text-primary">{uncovered.join(", ")}</p>
      </Modal>
    </form>
  );
}

export function NewBacktestPage() {
  const query = useStrategies();
  const instruments = useInstruments();
  const [params] = useSearchParams();
  if (query.isPending || instruments.isPending)
    return <Skeleton className="h-96 w-full max-w-3xl" />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const usable = query.data.filter((s) => s.status !== "archived");
  const preselected = usable.find((s) => s.id === params.get("strategy"));
  const latestData = instruments.data
    ?.map((i) => i.dataTo)
    .sort()
    .at(-1);
  return <BacktestFormView strategies={usable} preselected={preselected} latestData={latestData} />;
}
