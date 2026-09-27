import { Card, Checkbox, Skeleton } from "@nova/ui-core";
import { useMarketIndices } from "@nova/services";
import { QueryError } from "../../components/QueryState";

export interface IndexPickerProps {
  selected: string[];
  onChange: (names: string[]) => void;
}

/** Index prices to download like a stock (D62): used for the benchmark and the market filter. */
export function IndexPicker({ selected, onChange }: IndexPickerProps) {
  const indices = useMarketIndices();
  const toggle = (name: string, on: boolean) =>
    onChange(on ? [...selected, name] : selected.filter((n) => n !== name));
  return (
    <Card title={`Indices (${selected.length} chosen)`}>
      <div className="flex flex-col gap-3">
        <p className="text-body-sm text-text-muted">
          Index prices, used for the benchmark and the market filter.
        </p>
        {indices.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : indices.isError ? (
          <QueryError error={indices.error} onRetry={() => void indices.refetch()} />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {indices.data.map((index) => (
              <Checkbox
                key={index.name}
                label={index.name}
                checked={selected.includes(index.name)}
                onCheckedChange={(on) => toggle(index.name, on === true)}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
