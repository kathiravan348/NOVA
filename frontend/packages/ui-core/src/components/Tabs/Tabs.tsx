import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "../../lib/cn";

export interface TabItem {
  value: string;
  label: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  ariaLabel: string;
  className?: string;
}

export function Tabs({
  items,
  value,
  defaultValue,
  onValueChange,
  ariaLabel,
  className,
}: TabsProps): React.ReactElement {
  const initialValue = defaultValue ?? items[0]?.value;

  return (
    <TabsPrimitive.Root
      value={value}
      defaultValue={initialValue}
      onValueChange={onValueChange}
      className={cn("w-full flex flex-col", className)}
    >
      <div className="overflow-x-auto border-b border-border-default">
        <TabsPrimitive.List
          aria-label={ariaLabel}
          className="flex items-center gap-6 whitespace-nowrap min-w-max"
        >
          {items.map((item) => (
            <TabsPrimitive.Trigger
              key={item.value}
              value={item.value}
              disabled={item.disabled}
              className={cn(
                "relative py-3 text-body font-sans font-medium text-text-muted transition-colors cursor-pointer select-none",
                "hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-action rounded-xs",
                "data-[state=active]:text-text-primary data-[state=active]:font-semibold",
                "after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:scale-x-0 after:transition-transform",
                "data-[state=active]:after:scale-x-100 data-[state=active]:after:bg-action",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              )}
            >
              {item.label}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>
      </div>

      {items.map((item) => (
        <TabsPrimitive.Content
          key={item.value}
          value={item.value}
          className="py-4 focus:outline-hidden"
        >
          {item.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
