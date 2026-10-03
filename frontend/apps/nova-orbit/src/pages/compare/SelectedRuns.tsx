import { X } from "lucide-react";
import type { BacktestRun } from "@nova/contracts";
import { Button, Card, IconButton } from "@nova/ui-core";
import { dataSourceLabel, formatPeriod } from "../../lib/format";

export interface SelectedRunsProps {
  runs: BacktestRun[];
  onRemove: (id: string) => void;
  onChoose: () => void;
}

export function SelectedRuns({ runs, onRemove, onChoose }: SelectedRunsProps) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      {runs.map((run) => (
        <Card key={run.id} className="max-w-full p-3">
          <div className="flex items-start gap-3">
            <div className="min-w-0">
              <p className="break-words text-body-sm font-medium text-text-primary">
                {run.name} · v{run.version}
              </p>
              <p className="text-body-sm text-text-muted">
                {dataSourceLabel[run.dataSource]} · {formatPeriod(run.from, run.to)}
              </p>
            </div>
            <IconButton
              aria-label={`Remove ${run.name}`}
              icon={<X className="h-4 w-4" />}
              size="sm"
              variant="ghost"
              onClick={() => onRemove(run.id)}
            />
          </div>
        </Card>
      ))}
      <Button variant="secondary" onClick={onChoose}>
        Choose runs
      </Button>
    </div>
  );
}
