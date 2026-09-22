import * as React from "react";
import { cn } from "../../lib/cn";
import { fromZonedInputValue, toZonedInputValue } from "../../lib/zonedTime";
import { Field, getDescribedBy } from "../Field/Field";

export interface DateTimePickerProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange" | "id" | "min" | "max"
> {
  id?: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  error?: string;
  mode?: "datetime" | "date";
  timeZone?: string;
  timeZoneLabel?: string;
  value?: string | null;
  defaultValue?: string | null;
  min?: string;
  max?: string;
  onChange?: (value: string | null) => void;
  containerClassName?: string;
}

export const DateTimePicker = React.forwardRef<HTMLInputElement, DateTimePickerProps>(
  (
    {
      id,
      label,
      description,
      error,
      required,
      disabled,
      mode = "datetime",
      timeZone = "Asia/Kolkata",
      timeZoneLabel = "IST",
      value,
      defaultValue,
      min,
      max,
      onChange,
      containerClassName,
      className,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const pickerId = id ?? generatedId;
    const hasError = Boolean(error);
    const hasDescription = Boolean(description);
    const describedBy = getDescribedBy(pickerId, hasDescription, hasError);

    const inputValue =
      value !== undefined
        ? mode === "datetime"
          ? value
            ? toZonedInputValue(value, timeZone)
            : ""
          : (value ?? "")
        : undefined;

    const defaultInputValue =
      defaultValue !== undefined
        ? mode === "datetime"
          ? defaultValue
            ? toZonedInputValue(defaultValue, timeZone)
            : ""
          : (defaultValue ?? "")
        : undefined;

    const formattedMin = mode === "datetime" && min ? toZonedInputValue(min, timeZone) : min;
    const formattedMax = mode === "datetime" && max ? toZonedInputValue(max, timeZone) : max;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (!val) {
        onChange?.(null);
        return;
      }
      if (mode === "datetime") {
        const utcIso = fromZonedInputValue(val, timeZone);
        onChange?.(utcIso || null);
      } else {
        onChange?.(val);
      }
    };

    return (
      <Field
        label={label}
        htmlFor={pickerId}
        description={description}
        error={error}
        required={required}
        className={containerClassName}
      >
        <div className="relative flex items-center w-full">
          <input
            ref={ref}
            type={mode === "datetime" ? "datetime-local" : "date"}
            id={pickerId}
            value={inputValue}
            defaultValue={defaultInputValue}
            min={formattedMin}
            max={formattedMax}
            onChange={handleChange}
            disabled={disabled}
            required={required}
            aria-invalid={hasError ? true : undefined}
            aria-describedby={[ariaDescribedBy, describedBy].filter(Boolean).join(" ") || undefined}
            className={cn(
              "h-10 w-full rounded-md border bg-bg-surface px-3 font-sans text-body text-text-primary transition-colors cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-bg-ground",
              "disabled:pointer-events-none disabled:opacity-50",
              hasError ? "border-loss" : "border-border-strong",
              mode === "datetime" && timeZoneLabel ? "pr-14" : "",
              className,
            )}
            {...props}
          />
          {mode === "datetime" && timeZoneLabel && (
            <span
              className="absolute right-3 inset-y-0 flex items-center pointer-events-none text-text-muted text-body-sm font-sans font-medium"
              aria-hidden="true"
            >
              {timeZoneLabel}
            </span>
          )}
        </div>
      </Field>
    );
  },
);

DateTimePicker.displayName = "DateTimePicker";
