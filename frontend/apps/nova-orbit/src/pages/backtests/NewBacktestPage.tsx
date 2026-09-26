import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useSearchParams } from "react-router";
import type { BacktestRun, Strategy } from "@nova/contracts";
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
import {
  getDataMode,
  useAddBacktestVersion,
  useInstruments,
  useQueueBacktest,
  useStrategies,
} from "@nova/services";
import { coversPeriod, dataRange } from "../../components/InstrumentTable";
import { QueryError } from "../../components/QueryState";
import {
  BacktestFormSchema,
  defaultsFor,
  defaultsFromRun,
  todayIst,
  toRunCreate,
  toVersionCreate,
  type BacktestForm,
} from "./backtestForm";
import { UniverseFields } from "./UniverseFields";

/** The new-backtest form; with `editing` it queues the next version of that run (D60). */
export function BacktestFormView({
  strategies,
  preselected,
  latestData,
  editing,
  preselectedVersion,
}: {
  strategies: Strategy[];
  preselected?: Strategy;
  latestData?: string;
  editing?: BacktestRun;
  /** `?version=` from a strategy version page (D60). */
  preselectedVersion?: number;
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const instruments = useInstruments();
  const queueRun = useQueueBacktest();
  const addVersion = useAddBacktestVersion();
  const [uncovered, setUncovered] = useState<string[]>([]);
  const form = useForm<BacktestForm>({
    resolver: zodResolver(BacktestFormSchema),
    defaultValues: editing
      ? defaultsFromRun(editing)
      : {
          ...defaultsFor(preselected, todayIst(), latestData),
          ...(preselectedVersion ? { version: String(preselectedVersion) } : {}),
        },
  });
  const { register, control, handleSubmit, watch, setValue, setError, formState } = form;
  const { errors } = formState;
  const strategyId = watch("strategyId");
  const strategy = strategies.find((s) => s.id === strategyId);
  // Coverage is checked for the candle size of the chosen version (NOVA-097).
  const version = watch("version");
  const timeframe = strategy?.versions.find((v) => String(v.version) === version)?.spec.timeframe;

  // A new strategy starts on its latest version and a matching name.
  useEffect(() => {
    if (!strategy || !formState.dirtyFields.strategyId) return;
    setValue("version", String(strategy.latestVersion));
    setValue("name", `${strategy.name} backtest`);
  }, [strategy, formState.dirtyFields.strategyId, setValue]);

  const failed = (err: Error) =>
    toast.show({ title: "Could not queue the backtest", description: err.message, tone: "danger" });

  const queue = () => {
    if (editing) {
      const body = toVersionCreate(form.getValues());
      addVersion.mutate(
        { runId: editing.id, body },
        {
          onSuccess: (run) => {
            const demo = getDataMode() !== "real";
            toast.show({
              title: `Version ${run.version} queued${demo ? " (demo)" : ""}`,
              description: demo ? "Mock mode runs nothing." : run.name,
              tone: "success",
            });
            navigate(demo ? `/backtests/${editing.id}` : `/backtests/${run.id}`);
          },
          onError: failed,
        },
      );
      return;
    }
    queueRun.mutate(toRunCreate(form.getValues()), {
      onSuccess: (run) => {
        if (getDataMode() === "real") {
          toast.show({ title: "Backtest queued", description: run.name, tone: "success" });
          navigate(`/backtests/${run.id}`);
          return;
        }
        toast.show({
          title: "Backtest queued (demo)",
          description: "Mock mode runs nothing.",
          tone: "success",
        });
        navigate("/backtests");
      },
      onError: failed,
    });
  };

  // Symbols whose data does not cover the period must be dropped before queueing (R2).
  const onValid = (values: BacktestForm) => {
    if (values.universeType === "symbols") {
      const period = { from: values.from, to: values.to, timeframe };
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
          {editing ? (
            // A new version keeps its strategy; only the strategy version may change (D60).
            <Input label="Strategy" value={strategy?.name ?? editing.strategyId} readOnly />
          ) : (
            <Select
              label="Strategy"
              placeholder="Choose a strategy"
              options={strategies.map((s) => ({ value: s.id, label: s.name }))}
              error={errors.strategyId?.message}
              {...register("strategyId")}
            />
          )}
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
      <UniverseFields form={form} timeframe={timeframe} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={queueRun.isPending || addVersion.isPending}>
          {editing ? "Queue new version" : "Queue backtest"}
        </Button>
        <Button asChild variant="secondary">
          <Link to={editing ? `/backtests/${editing.id}` : "/backtests"}>Cancel</Link>
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
  const asked = Number(params.get("version"));
  const preselectedVersion = preselected?.versions.some((v) => v.version === asked)
    ? asked
    : undefined;
  // Default end date: the newest data in the preselected strategy's timeframe, else in any.
  const latest = preselected?.versions.find((v) => v.version === preselected.latestVersion);
  const latestData = (instruments.data ?? [])
    .map((i) => dataRange(i, latest?.spec.timeframe)?.to)
    .filter((to): to is string => to !== undefined)
    .sort()
    .at(-1);
  return (
    <BacktestFormView
      strategies={usable}
      preselected={preselected}
      latestData={latestData}
      preselectedVersion={preselectedVersion}
    />
  );
}
