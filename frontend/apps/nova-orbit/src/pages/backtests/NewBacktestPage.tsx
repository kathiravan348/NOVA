import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useSearchParams } from "react-router";
import { IndexNameSchema, type Strategy } from "@nova/contracts";
import {
  Button,
  Card,
  DateTimePicker,
  Input,
  Select,
  Skeleton,
  Switch,
  useToast,
} from "@nova/ui-core";
import { useStrategies } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import {
  BacktestFormSchema,
  defaultsFor,
  splitSymbols,
  todayIst,
  type BacktestForm,
} from "./backtestForm";

function BacktestFormView({
  strategies,
  preselected,
}: {
  strategies: Strategy[];
  preselected?: Strategy;
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const form = useForm<BacktestForm>({
    resolver: zodResolver(BacktestFormSchema),
    defaultValues: defaultsFor(preselected),
  });
  const { register, control, handleSubmit, watch, setValue, formState } = form;
  const { errors } = formState;
  const strategyId = watch("strategyId");
  const strategy = strategies.find((s) => s.id === strategyId);
  const universeType = watch("universeType");

  // A new strategy starts on its latest version and a matching name.
  useEffect(() => {
    if (!strategy || !formState.dirtyFields.strategyId) return;
    setValue("version", String(strategy.latestVersion));
    setValue("name", `${strategy.name} backtest`);
  }, [strategy, formState.dirtyFields.strategyId, setValue]);

  const onValid = () => {
    toast.show({
      title: "Backtest queued (demo)",
      description: "Nothing runs in Stage A.",
      tone: "success",
    });
    navigate("/backtests");
  };

  const versions = [...(strategy?.versions ?? [])].sort((a, b) => b.version - a.version);

  return (
    <form onSubmit={handleSubmit(onValid)} noValidate className="flex max-w-3xl flex-col gap-6">
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
      <Card title="Symbols">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Test on"
            options={[
              { value: "symbols", label: "Chosen symbols" },
              { value: "index", label: "A whole index" },
            ]}
            {...register("universeType")}
          />
          {universeType === "index" ? (
            <Select
              label="Index"
              options={IndexNameSchema.options.map((v) => ({ value: v, label: v }))}
              {...register("index")}
            />
          ) : (
            <Controller
              control={control}
              name="symbols"
              render={({ field }) => (
                <Input
                  label="Symbols"
                  description="Comma separated, e.g. RELIANCE, TCS"
                  defaultValue={field.value.join(", ")}
                  onChange={(e) => field.onChange(splitSymbols(e.target.value))}
                  onBlur={field.onBlur}
                  error={errors.symbols?.message}
                />
              )}
            />
          )}
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
      <div className="flex flex-wrap gap-3">
        <Button type="submit">Queue backtest</Button>
        <Button asChild variant="secondary">
          <Link to="/backtests">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

export function NewBacktestPage() {
  const query = useStrategies();
  const [params] = useSearchParams();
  if (query.isPending) return <Skeleton className="h-96 w-full max-w-3xl" />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const usable = query.data.filter((s) => s.status !== "archived");
  const preselected = usable.find((s) => s.id === params.get("strategy"));
  return <BacktestFormView strategies={usable} preselected={preselected} />;
}
