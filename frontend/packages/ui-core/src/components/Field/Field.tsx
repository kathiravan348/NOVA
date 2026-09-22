import * as React from "react";
import { cn } from "../../lib/cn";

export interface FieldProps {
  label: React.ReactNode;
  htmlFor: string;
  description?: React.ReactNode;
  error?: string;
  required?: boolean;
  labelPosition?: "top" | "right";
  children: React.ReactNode;
  className?: string;
}

export function getDescribedBy(
  id: string,
  hasDescription?: boolean,
  hasError?: boolean,
): string | undefined {
  const ids: string[] = [];
  if (hasDescription) ids.push(`${id}-description`);
  if (hasError) ids.push(`${id}-error`);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

export function Field({
  label,
  htmlFor,
  description,
  error,
  required = false,
  labelPosition = "top",
  children,
  className,
}: FieldProps) {
  const isRight = labelPosition === "right";

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {isRight ? (
        <div className="flex items-center gap-2.5">
          {children}
          <label
            htmlFor={htmlFor}
            className="text-body font-sans text-text-primary cursor-pointer select-none"
          >
            {label}
            {required && (
              <span className="text-loss ml-1" aria-hidden="true">
                *
              </span>
            )}
          </label>
        </div>
      ) : (
        <>
          <label
            htmlFor={htmlFor}
            className="block text-label font-sans font-medium text-text-primary"
          >
            {label}
            {required && (
              <span className="text-loss ml-1" aria-hidden="true">
                *
              </span>
            )}
          </label>
          {children}
        </>
      )}
      {description && (
        <p id={`${htmlFor}-description`} className="text-body-sm text-text-muted">
          {description}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} className="text-body-sm text-loss" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
