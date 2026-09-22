import { useFormContext } from "react-hook-form";
import { Input, Select, type SelectOption } from "@nova/ui-core";
import type { EditorForm } from "./editorForm";

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

const indicatorOptions: SelectOption[] = [
  { value: "sma", label: "SMA" },
  { value: "ema", label: "EMA" },
  { value: "rsi", label: "RSI" },
  { value: "macd", label: "MACD" },
  { value: "vwap", label: "VWAP" },
  { value: "atr", label: "ATR" },
  { value: "bb_upper", label: "Bollinger upper" },
  { value: "bb_lower", label: "Bollinger lower" },
];

export interface OperandFieldsProps {
  name: OperandPath;
  /** Visible label, e.g. "Left". */
  label: string;
  /** Screen-reader context, e.g. "entry condition 1". */
  context: string;
}

export function OperandFields({ name, label, context }: OperandFieldsProps) {
  const { register, watch, getFieldState, formState } = useFormContext<EditorForm>();
  const kind = watch(`${name}.kind`);
  const indicator = watch(`${name}.name`);
  const sr = <span className="sr-only">, {context}</span>;

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
          error={getFieldState(`${name}.value`, formState).error?.message}
          {...register(`${name}.value`)}
        />
      )}
      {kind === "indicator" && (
        <Select
          label={<>Indicator{sr}</>}
          options={indicatorOptions}
          {...register(`${name}.name`)}
        />
      )}
      {kind === "indicator" && indicator !== "vwap" && (
        <Input
          label={<>Period{sr}</>}
          inputMode="numeric"
          containerClassName="col-span-2"
          error={getFieldState(`${name}.period`, formState).error?.message}
          {...register(`${name}.period`)}
        />
      )}
    </div>
  );
}
