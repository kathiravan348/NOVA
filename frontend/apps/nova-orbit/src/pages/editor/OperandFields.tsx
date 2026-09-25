import { useFormContext } from "react-hook-form";
import { INDICATORS, indicatorDef, type IndicatorGroup, type IndicatorName } from "@nova/contracts";
import { Input, Select, type SelectOption } from "@nova/ui-core";
import { defaultParams, type EditorForm } from "./editorForm";

export type OperandPath = `${"entry" | "exit"}.conditions.${number}.${"left" | "right"}`;

const kindOptions: SelectOption[] = [
  { value: "price", label: "Price" },
  { value: "indicator", label: "Indicator" },
  { value: "number", label: "Number" },
];

const fieldOptions: SelectOption[] = [
  { value: "open", label: "Open" },
  { value: "high", label: "High" },
  { value: "low", label: "Low" },
  { value: "close", label: "Close" },
  { value: "volume", label: "Volume" },
];

const groupLabel: Record<IndicatorGroup, string> = {
  trend: "Trend",
  momentum: "Momentum",
  volatility: "Volatility",
  volume: "Volume",
  levels: "Levels (previous day)",
};

const indicatorOptions: SelectOption[] = INDICATORS.map((i) => ({
  value: i.name,
  label: i.label,
  group: groupLabel[i.group],
}));

export interface OperandFieldsProps {
  name: OperandPath;
  /** Visible label, e.g. "Left". */
  label: string;
  /** Screen-reader context, e.g. "entry condition 1". */
  context: string;
}

export function OperandFields({ name, label, context }: OperandFieldsProps) {
  const { register, watch, setValue, getFieldState, formState } = useFormContext<EditorForm>();
  const kind = watch(`${name}.kind`);
  const indicator = watch(`${name}.name`);
  const params = indicatorDef(indicator)?.params ?? [];
  const sr = <span className="sr-only">, {context}</span>;
  const errorOf = (path: `${OperandPath}.${"value" | "offset" | `params.${string}`}`) =>
    getFieldState(path, formState).error?.message;
  const nameField = register(`${name}.name`);

  return (
    <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
      <Select
        label={
          <>
            {label}
            {sr}
          </>
        }
        options={kindOptions}
        {...register(`${name}.kind`)}
      />
      {kind === "price" && (
        <Select label={<>Field{sr}</>} options={fieldOptions} {...register(`${name}.field`)} />
      )}
      {kind === "number" && (
        <Input
          label={<>Value{sr}</>}
          inputMode="decimal"
          error={errorOf(`${name}.value`)}
          {...register(`${name}.value`)}
        />
      )}
      {kind === "indicator" && (
        <Select
          label={<>Indicator{sr}</>}
          options={indicatorOptions}
          {...nameField}
          onChange={(e) => {
            void nameField.onChange(e);
            setValue(`${name}.params`, defaultParams(e.target.value as IndicatorName), {
              shouldValidate: formState.isSubmitted,
            });
          }}
        />
      )}
      {kind === "indicator" &&
        params.map((p) => (
          <Input
            key={`${indicator}-${p.key}`}
            label={
              <>
                {p.label}
                {sr}
              </>
            }
            inputMode={p.integer ? "numeric" : "decimal"}
            error={errorOf(`${name}.params.${p.key}`)}
            {...register(`${name}.params.${p.key}`)}
          />
        ))}
      {kind !== "number" && (
        <Input
          label={<>Bars ago{sr}</>}
          inputMode="numeric"
          error={errorOf(`${name}.offset`)}
          {...register(`${name}.offset`)}
        />
      )}
    </div>
  );
}
