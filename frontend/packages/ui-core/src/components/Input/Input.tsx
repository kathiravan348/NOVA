import * as React from "react";
import { cn } from "../../lib/cn";
import { Field, getDescribedBy } from "../Field/Field";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "id"> {
  id?: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  error?: string;
  required?: boolean;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  numeric?: boolean;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      id,
      label,
      description,
      error,
      required,
      leading,
      trailing,
      numeric,
      containerClassName,
      className,
      inputMode,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const hasError = Boolean(error);
    const hasDescription = Boolean(description);
    const describedBy = getDescribedBy(inputId, hasDescription, hasError);

    return (
      <Field
        label={label}
        htmlFor={inputId}
        description={description}
        error={error}
        required={required}
        className={containerClassName}
      >
        <div className="relative flex items-center w-full">
          {leading && (
            <span
              className="absolute left-3 inset-y-0 flex items-center pointer-events-none text-text-muted text-body-sm"
              aria-hidden="true"
            >
              {leading}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            required={required}
            aria-invalid={hasError ? true : undefined}
            aria-describedby={
              [props["aria-describedby"], describedBy].filter(Boolean).join(" ") || undefined
            }
            inputMode={numeric ? (inputMode ?? "decimal") : inputMode}
            className={cn(
              "h-10 w-full rounded-md border bg-bg-surface px-3 font-sans text-body text-text-primary placeholder:text-text-muted transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-bg-ground",
              "disabled:pointer-events-none disabled:opacity-50",
              hasError ? "border-loss" : "border-border-strong",
              leading ? "pl-9" : "",
              trailing ? "pr-9" : "",
              numeric ? "font-mono text-right" : "",
              className,
            )}
            {...props}
          />
          {trailing && (
            <span
              className="absolute right-3 inset-y-0 flex items-center pointer-events-none text-text-muted text-body-sm"
              aria-hidden="true"
            >
              {trailing}
            </span>
          )}
        </div>
      </Field>
    );
  },
);

Input.displayName = "Input";
