import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";
import { Field, getDescribedBy } from "../Field/Field";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  /** Consecutive options with the same group render inside one `<optgroup>`. */
  group?: string;
}

type OptionRun = { group?: string; options: SelectOption[] };

/** Splits options into runs of the same group, keeping their order. */
function runsOf(options: SelectOption[]): OptionRun[] {
  const runs: OptionRun[] = [];
  for (const option of options) {
    const last = runs[runs.length - 1];
    if (last && last.group === option.group) last.options.push(option);
    else runs.push({ group: option.group, options: [option] });
  }
  return runs;
}

const renderOption = (option: SelectOption) => (
  <option key={option.value} value={option.value} disabled={option.disabled}>
    {option.label}
  </option>
);

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  id?: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  error?: string;
  required?: boolean;
  options: SelectOption[];
  placeholder?: string;
  containerClassName?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      id,
      label,
      description,
      error,
      required,
      options,
      placeholder,
      containerClassName,
      className,
      "aria-describedby": ariaDescribedBy,
      defaultValue,
      children,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const selectId = id ?? generatedId;
    const hasError = Boolean(error);
    const hasDescription = Boolean(description);
    const describedBy = getDescribedBy(selectId, hasDescription, hasError);

    return (
      <Field
        label={label}
        htmlFor={selectId}
        description={description}
        error={error}
        required={required}
        className={containerClassName}
      >
        <div className="relative flex items-center w-full">
          <select
            ref={ref}
            id={selectId}
            required={required}
            defaultValue={
              defaultValue ?? (placeholder && props.value === undefined ? "" : undefined)
            }
            aria-invalid={hasError ? true : undefined}
            aria-describedby={[ariaDescribedBy, describedBy].filter(Boolean).join(" ") || undefined}
            className={cn(
              "h-10 w-full appearance-none rounded-md border bg-bg-surface pl-3 pr-10 font-sans text-body text-text-primary transition-colors cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-bg-ground",
              "disabled:pointer-events-none disabled:opacity-50",
              hasError ? "border-loss" : "border-border-strong",
              className,
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {runsOf(options).map((run, i) =>
              run.group === undefined ? (
                run.options.map(renderOption)
              ) : (
                <optgroup key={`${run.group}-${i}`} label={run.group}>
                  {run.options.map(renderOption)}
                </optgroup>
              ),
            )}
            {children}
          </select>
          <span
            className="absolute right-3 inset-y-0 flex items-center pointer-events-none text-text-muted"
            aria-hidden="true"
          >
            <ChevronDown className="h-4 w-4" />
          </span>
        </div>
      </Field>
    );
  },
);

Select.displayName = "Select";
