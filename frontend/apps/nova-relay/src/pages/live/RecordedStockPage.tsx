import { Link, useParams } from "react-router";
import { Database } from "lucide-react";
import { EmptyState, Skeleton } from "@nova/ui-core";
import { useLiveDays } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { DayCard } from "./DayCard";

/** What was recorded for one stock, newest day first. */
export function RecordedStockPage() {
  const { symbol = "" } = useParams();
  const days = useLiveDays(symbol);
  const sorted = [...(days.data ?? [])].sort((a, b) => b.day.localeCompare(a.day));
  return (
    <div className="flex flex-col gap-4">
      <p>
        <Link className="text-action underline" to="/live/recorded">
          All recorded stocks
        </Link>
      </p>
      <h2 className="text-card-title">{symbol}</h2>
      {days.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : days.isError ? (
        <QueryError error={days.error} onRetry={() => void days.refetch()} />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<Database className="h-6 w-6" />}
          title="Nothing recorded for this stock yet"
          description="Prices are recorded on weekdays from 09:15 to 15:30 when recording is on."
          action={<Link to="/data-jobs">Open Data jobs</Link>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((day) => (
            <DayCard key={day.day} day={day} />
          ))}
        </div>
      )}
    </div>
  );
}
