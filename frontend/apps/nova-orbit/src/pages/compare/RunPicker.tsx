import type { BacktestRun } from "@nova/contracts";
import { Card, Checkbox } from "@nova/ui-core";
import { formatPeriod } from "../../lib/format";
import { summarizeUniverse } from "../../lib/strategyText";
import { MAX_RUNS } from "./compareMetrics";

export interface RunPickerProps {
  runs: BacktestRun[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

/** Checkbox list of completed runs; at most three can be chosen. */
export function RunPicker({ runs, selected, onChange }: RunPickerProps) {
  const full = selected.length >= MAX_RUNS;
  const toggle = (id: string, checked: boolean) =>
    onChange(checked ? [...selected, id] : selected.filter((s) => s !== id));

  return (
    <Card title="Runs to compare">
      <div className="flex flex-col gap-3">
        <p className="text-body-sm text-text-muted">Choose 2 or 3 completed runs.</p>
        {runs.map((run) => {
          const checked = selected.includes(run.id);
          return (
            <Checkbox
              key={run.id}
              label={run.name}
              description={`${formatPeriod(run.from, run.to)} · ${summarizeUniverse(run.universe)}`}
              checked={checked}
              disabled={!checked && full}
              onCheckedChange={(value) => toggle(run.id, value === true)}
            />
          );
        })}
      </div>
    </Card>
  );
}
