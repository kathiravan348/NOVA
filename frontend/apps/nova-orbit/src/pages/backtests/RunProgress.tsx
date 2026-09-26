import { useEffect, useState } from "react";
import { Hourglass } from "lucide-react";
import type { BacktestRun } from "@nova/contracts";
import { Card, EmptyState } from "@nova/ui-core";
import { Meter, formatPercent } from "@nova/ui-trading";
import { progressLine, runningFor, timeLeft } from "./progressText";

function useNow(everyMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

/** A queued or running run: live progress, what it is doing, time running and left (D58). */
export function RunProgress({ run }: { run: BacktestRun }) {
  const now = useNow(1_000);
  if (run.status === "queued" || !run.startedAt) {
    return (
      <EmptyState
        icon={<Hourglass className="h-6 w-6" />}
        title="Waiting to start"
        description="This run is in the queue. It starts when the runs before it finish."
      />
    );
  }
  const progress = run.progress;
  const percent = progress?.percent ?? 0;
  const left = timeLeft(run.startedAt, percent, now);
  return (
    <Card title="Running">
      <div className="flex flex-col gap-3">
        <Meter
          label="Progress"
          value={percent}
          max={100}
          valueText={formatPercent(percent, { decimals: 0 })}
          warnAt={2}
          dangerAt={2}
        />
        <p className="text-body text-text-primary">
          {progress ? progressLine(progress) : "Starting"}
        </p>
        <p className="flex flex-col gap-1 text-body-sm text-text-muted sm:flex-row sm:gap-3">
          <span>{runningFor(run.startedAt, now)}</span>
          {left && <span>{left}</span>}
        </p>
      </div>
    </Card>
  );
}
