import { Skeleton } from "@nova/ui-core";
import { useRecorder } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { RecordedStocksTable } from "./RecordedStocksTable";
import { RecorderCard } from "./RecorderCard";

/** Live → Config (D74 (3)): the recording switch and which stocks to record. */
export function ConfigPage() {
  const recorder = useRecorder();
  return (
    <div className="flex flex-col gap-4">
      <RecorderCard />
      {recorder.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : recorder.isError ? (
        <QueryError error={recorder.error} onRetry={() => void recorder.refetch()} />
      ) : (
        <RecordedStocksTable settings={recorder.data} />
      )}
    </div>
  );
}
