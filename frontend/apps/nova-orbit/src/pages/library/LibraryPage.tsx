import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { BookOpen, SearchX } from "lucide-react";
import type { LibraryEntry, LibraryFamilyId, Strategy } from "@nova/contracts";
import { Button, EmptyState, Input, Modal, Skeleton, useToast } from "@nova/ui-core";
import { useInstallLibrary, useStrategies, useStrategyLibrary } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { LibraryFamilyCard } from "./LibraryFamilyCard";

const plural = (count: number) => (count === 1 ? "1 strategy" : `${count} strategies`);

/** The run form link for an entry's suggested first backtest (D62 (7), STRATEGY-LIBRARY §2). */
export function backtestLink(entry: LibraryEntry, strategyId: string): string {
  const test = entry.backtest;
  const params = new URLSearchParams({ strategy: strategyId });
  if (test.universe.type === "index") params.set("index", test.universe.index);
  params.set("from", test.from);
  params.set("to", test.to);
  params.set("capital", String(test.initialCapitalPaise / 100));
  params.set("benchmark", test.benchmark ?? "none");
  params.set("name", `${entry.name} — v1 in-sample`);
  return `/backtests/new?${params.toString()}`;
}

/** Orbit's Library: 60 ready-made strategies by family; Add, Add all, Backtest (D62 (7)). */
export function LibraryPage() {
  const library = useStrategyLibrary();
  const strategies = useStrategies();
  const install = useInstallLibrary();
  const toast = useToast();
  const navigate = useNavigate();
  const [family, setFamily] = useState<LibraryFamilyId | "all">("all");
  const [search, setSearch] = useState("");
  const [confirming, setConfirming] = useState(false);
  // Entries added in this visit: shown as added before the strategy list refetches (and in demo).
  const [justAdded, setJustAdded] = useState<ReadonlySet<string>>(new Set());

  // "Already added" = a strategy with the entry's name exists (worked out here, NOVA-122).
  const byName = useMemo(
    () => new Map<string, Strategy>((strategies.data ?? []).map((s) => [s.name, s])),
    [strategies.data],
  );
  if (library.isPending || strategies.isPending) return <Skeleton className="h-96 w-full" />;
  if (library.isError) {
    return <QueryError error={library.error} onRetry={() => void library.refetch()} />;
  }
  if (strategies.isError) {
    return <QueryError error={strategies.error} onRetry={() => void strategies.refetch()} />;
  }
  const { families, entries } = library.data;
  const added = new Set(
    entries.filter((e) => byName.has(e.name) || justAdded.has(e.id)).map((e) => e.id),
  );
  const missing = entries.filter((e) => !added.has(e.id));
  const words = search.trim().toLowerCase();
  const shown = entries.filter(
    (e) =>
      (family === "all" || e.family === family) &&
      (words === "" || `${e.id} ${e.name} ${e.summary}`.toLowerCase().includes(words)),
  );

  const add = (ids: string[], then?: (created: Strategy[]) => void) =>
    install.mutate(ids, {
      onSuccess: (created) => {
        setJustAdded((before) => new Set([...before, ...ids]));
        toast.show({ title: `Added ${plural(created.length)}`, tone: "success" });
        then?.(created);
      },
      onError: (err) =>
        toast.show({ title: "Could not add", description: err.message, tone: "danger" }),
    });

  const backtest = (entry: LibraryEntry) => {
    const existing = byName.get(entry.name);
    if (existing) {
      navigate(backtestLink(entry, existing.id));
      return;
    }
    add([entry.id], (created) => navigate(backtestLink(entry, created[0]!.id)));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body text-text-secondary">
          {entries.length} ready-made strategies. Add them as drafts, then backtest. Results are
          evidence, not promises.
        </p>
        <Button
          type="button"
          disabled={missing.length === 0 || install.isPending}
          onClick={() => setConfirming(true)}
        >
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          Add all
        </Button>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Family">
          {[{ id: "all" as const, name: "All" }, ...families].map((f) => (
            <Button
              key={f.id}
              type="button"
              size="sm"
              variant={family === f.id ? "primary" : "secondary"}
              aria-pressed={family === f.id}
              onClick={() => setFamily(f.id)}
            >
              {f.name}
            </Button>
          ))}
        </div>
        <Input
          label="Search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          containerClassName="lg:w-72"
        />
      </div>
      {shown.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-6 w-6" />}
          title="No strategy matches"
          description="Clear the search or choose All."
        />
      ) : (
        families
          .filter((f) => shown.some((e) => e.family === f.id))
          .map((f) => (
            <LibraryFamilyCard
              key={f.id}
              family={f}
              entries={shown.filter((e) => e.family === f.id)}
              added={added}
              busy={install.isPending}
              onAdd={(entry) => add([entry.id])}
              onBacktest={backtest}
            />
          ))
      )}
      <Modal
        open={confirming}
        onOpenChange={setConfirming}
        title={`Add all ${entries.length} as draft strategies?`}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              loading={install.isPending}
              onClick={() =>
                add(
                  missing.map((e) => e.id),
                  () => setConfirming(false),
                )
              }
            >
              Add {plural(missing.length)}
            </Button>
          </>
        }
      >
        <p className="text-body text-text-secondary">Ones you already have are skipped.</p>
      </Modal>
    </div>
  );
}
