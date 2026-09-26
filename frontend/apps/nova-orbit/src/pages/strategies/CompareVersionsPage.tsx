import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import type { Strategy } from "@nova/contracts";
import { Button, Card, EmptyState, Switch, cn } from "@nova/ui-core";
import { useStrategy } from "@nova/services";
import { QueryState } from "../../components/QueryState";
import { diffLines, specLines, type DiffLine } from "../../lib/specLines";
import { VersionRecord, useVersionStats } from "./StrategyVersionPage";

const statusText: Record<DiffLine["status"], string> = {
  same: "Same",
  changed: "Changed",
  "only-a": "Removed",
  "only-b": "Added",
};

function Cell({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5 sm:block">
      <span className="text-body-sm text-text-muted sm:hidden">{label}</span>
      <span className="whitespace-pre-wrap break-words font-mono text-body text-text-primary">
        {value ?? "—"}
      </span>
    </div>
  );
}

function Row({ line, a, b }: { line: DiffLine; a: string; b: string }) {
  const differs = line.status !== "same";
  return (
    <li
      className={cn(
        "grid gap-2 border-b border-border-default px-3 py-2 sm:grid-cols-[10rem_1fr_1fr] sm:gap-4",
        differs && "bg-warning-subtle",
      )}
    >
      <span className="text-body-sm font-medium text-text-secondary">
        {line.label}
        {differs && <span className="ml-2 text-warning-text">{statusText[line.status]}</span>}
      </span>
      <Cell label={a} value={line.a} />
      <Cell label={b} value={line.b} />
    </li>
  );
}

function Comparison({ strategy, a, b }: { strategy: Strategy; a: number; b: number }) {
  const [changesOnly, setChangesOnly] = useState(false);
  const records = useVersionStats(strategy.id);
  const left = strategy.versions.find((v) => v.version === a);
  const right = strategy.versions.find((v) => v.version === b);
  const back = (
    <Button asChild variant="secondary" size="sm">
      <Link to={`/strategies/${strategy.id}`}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to {strategy.name}
      </Link>
    </Button>
  );
  if (!left || !right || a === b) {
    return (
      <EmptyState
        title="Pick two versions"
        description="Tick two different versions on the strategy's Versions tab, then press Compare versions."
        action={back}
      />
    );
  }
  const lines = diffLines(specLines(left.spec), specLines(right.spec));
  const shown = changesOnly ? lines.filter((l) => l.status !== "same") : lines;
  const changed = lines.length - lines.filter((l) => l.status === "same").length;
  const va = `v${a}`;
  const vb = `v${b}`;
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-page-title text-text-primary">
              {strategy.name}: {va} and {vb}
            </h2>
            <div className="sm:ml-auto">{back}</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[left, right].map((v) => (
              <div key={v.version} className="flex flex-col gap-1">
                <Link
                  to={`/strategies/${strategy.id}/versions/${v.version}`}
                  className="font-medium text-action-text hover:underline"
                >
                  v{v.version} · {v.note}
                </Link>
                <span className="text-body-sm text-text-primary">
                  <VersionRecord stats={records.get(v.version)} />
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>
      <Card
        title={`${changed} line${changed === 1 ? "" : "s"} differ`}
        actions={
          <Switch
            label="Show changes only"
            checked={changesOnly}
            onCheckedChange={setChangesOnly}
          />
        }
      >
        <div className="hidden grid-cols-[10rem_1fr_1fr] gap-4 px-3 pb-2 text-body-sm font-medium text-text-muted sm:grid">
          <span>Setting</span>
          <span>{va}</span>
          <span>{vb}</span>
        </div>
        <ul aria-label={`Differences between ${va} and ${vb}`} className="flex flex-col">
          {shown.map((line) => (
            <Row key={line.key} line={line} a={va} b={vb} />
          ))}
        </ul>
      </Card>
    </div>
  );
}

/** Two strategy versions side by side, changes highlighted (D60). `?a=1&b=3`, older left. */
export function CompareVersionsPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const query = useStrategy(id);
  const picked = [Number(params.get("a")), Number(params.get("b"))].sort((x, y) => x - y);
  return (
    <QueryState query={query} back={{ to: "/strategies", label: "Back to strategies" }}>
      {(strategy) => <Comparison strategy={strategy} a={picked[0]!} b={picked[1]!} />}
    </QueryState>
  );
}
