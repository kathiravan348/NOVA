import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "../../lib/cn";
import { Field, getDescribedBy } from "../Field/Field";

export interface CheckboxProps extends Omit<
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
  "id"
> {
  id?: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  error?: string;
  containerClassName?: string;
}

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(
  (
    {
      id,
      label,
      description,
      error,
      required,
      disabled,
      checked,
      onCheckedChange,
      containerClassName,
      className,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const checkboxId = id ?? generatedId;
    const hasError = Boolean(error);
    const hasDescription = Boolean(description);
    const describedBy = getDescribedBy(checkboxId, hasDescription, hasError);

    return (
      <Field
        label={label}
        htmlFor={checkboxId}
        description={description}
        error={error}
        required={required}
        labelPosition="right"
        className={containerClassName}
      >
        <CheckboxPrimitive.Root
          ref={ref}
          id={checkboxId}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          required={required}
          aria-invalid={hasError ? true : undefined}
          aria-describedby={[ariaDescribedBy, describedBy].filter(Boolean).join(" ") || undefined}
          className={cn(
            "peer h-5 w-5 shrink-0 rounded-md border bg-bg-surface transition-colors cursor-pointer flex items-center justify-center",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-bg-ground",
            "disabled:pointer-events-none disabled:opacity-50",
            "data-[state=checked]:bg-action data-[state=checked]:border-action data-[state=checked]:text-on-action",
            "data-[state=indeterminate]:bg-action data-[state=indeterminate]:border-action data-[state=indeterminate]:text-on-action",
            hasError ? "border-loss" : "border-border-strong",
            className,
          )}
          {...props}
        >
          <CheckboxPrimitive.Indicator
            className="flex items-center justify-center text-current"
            aria-hidden="true"
          >
            {checked === "indeterminate" ? (
              <Minus className="h-3.5 w-3.5 stroke-[3]" />
            ) : (
              <Check className="h-3.5 w-3.5 stroke-[3]" />
            )}
          </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
      </Field>
    );
  },
);

Checkbox.displayName = "Checkbox";
