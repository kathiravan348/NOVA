import { Construction } from "lucide-react";
import { EmptyState } from "@nova/ui-core";

export interface PlaceholderPageProps {
  title: string;
}

/** Stand-in for a screen that a later task builds; the page title is in the top bar. */
export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <EmptyState
      icon={<Construction className="h-6 w-6" />}
      title="Not built yet"
      description={`${title} arrives in a later task.`}
    />
  );
}
