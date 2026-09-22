import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "../../lib/cn";
import { Field, getDescribedBy } from "../Field/Field";

export interface SwitchProps extends Omit<
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>,
  "id"
> {
  id?: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  error?: string;
  containerClassName?: string;
}

export const Switch = React.forwardRef<React.ElementRef<typeof SwitchPrimitive.Root>, SwitchProps>(
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
    const switchId = id ?? generatedId;
    const hasError = Boolean(error);
    const hasDescription = Boolean(description);
    const describedBy = getDescribedBy(switchId, hasDescription, hasError);

    return (
      <Field
        label={label}
        htmlFor={switchId}
        description={description}
        error={error}
        required={required}
        labelPosition="right"
        className={containerClassName}
      >
        <SwitchPrimitive.Root
          ref={ref}
          id={switchId}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          required={required}
          aria-invalid={hasError ? true : undefined}
          aria-describedby={[ariaDescribedBy, describedBy].filter(Boolean).join(" ") || undefined}
          className={cn(
            "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-pill border-2 border-transparent transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-bg-ground",
            "disabled:pointer-events-none disabled:opacity-50",
            "bg-border-strong data-[state=checked]:bg-action",
            hasError ? "border-loss" : "",
            className,
          )}
          {...props}
        >
          <SwitchPrimitive.Thumb
            className={cn(
              "pointer-events-none block h-5 w-5 rounded-pill bg-[white] shadow-sm transition-transform",
              "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
            )}
          />
        </SwitchPrimitive.Root>
      </Field>
    );
  },
);

Switch.displayName = "Switch";
