import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button, Input, Select } from "@nova/ui-core";
import { segmentLabel, strategyStatusLabel, timeframeLabel } from "../../lib/format";
import {
  EMPTY_FILTERS,
  SORT_LABELS,
  hasFilters,
  hasMoreFilters,
  type StrategyFilterValues,
} from "./strategyFilters";

interface StrategyFiltersProps {
  values: StrategyFilterValues;
  onChange: (values: StrategyFilterValues) => void;
}
const options = (labels: Record<string, string>) => [
  { value: "all", label: "All" },
  ...Object.entries(labels).map(([value, label]) => ({ value, label })),
];

export function StrategyFilters({ values, onChange }: StrategyFiltersProps) {
  const [draft, setDraft] = useState(values);
  const [more, setMore] = useState(() => hasMoreFilters(values));
  useEffect(() => setDraft(values), [values]);
  useEffect(() => {
    if (hasMoreFilters(values)) setMore(true);
  }, [values]);
  useEffect(() => {
    if (draft.q === values.q && draft.minBestCagr === values.minBestCagr) return;
    const timer = setTimeout(() => onChange(draft), 400);
    return () => clearTimeout(timer);
  }, [draft, values, onChange]);
  const change = (patch: Partial<StrategyFilterValues>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onChange(next);
  };
  const clear = () => {
    setDraft(EMPTY_FILTERS);
    setMore(false);
    onChange(EMPTY_FILTERS);
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          label="Search"
          type="search"
          placeholder="Strategy name"
          maxLength={200}
          value={draft.q}
          onChange={(event) => setDraft({ ...draft, q: event.target.value })}
        />
        <Select
          label="Status"
          value={draft.status}
          options={options(strategyStatusLabel)}
          onChange={(event) =>
            change({ status: event.target.value as StrategyFilterValues["status"] })
          }
        />
        <Select
          label="Results from"
          value={draft.dataSource}
          options={[
            { value: "all", label: "All data" },
            { value: "history", label: "History data" },
            { value: "recorded", label: "Recorded data" },
          ]}
          onChange={(event) =>
            change({ dataSource: event.target.value as StrategyFilterValues["dataSource"] })
          }
        />
        <Select
          label="Sort by"
          value={draft.sort}
          options={Object.entries(SORT_LABELS).map(([value, label]) => ({ value, label }))}
          onChange={(event) => change({ sort: event.target.value as StrategyFilterValues["sort"] })}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" aria-expanded={more} onClick={() => setMore(!more)}>
          {more ? (
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )}
          More filters
        </Button>
        {hasFilters(draft) && (
          <Button variant="ghost" size="sm" onClick={clear}>
            Clear filters
          </Button>
        )}
      </div>
      {more && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Select
            label="Mode"
            value={draft.mode}
            options={options({ visual: "Visual", python: "Python", rotation: "Rotation" })}
            onChange={(event) =>
              change({ mode: event.target.value as StrategyFilterValues["mode"] })
            }
          />
          <Select
            label="Segment"
            value={draft.segment}
            options={options(segmentLabel)}
            onChange={(event) =>
              change({ segment: event.target.value as StrategyFilterValues["segment"] })
            }
          />
          <Select
            label="Timeframe"
            value={draft.timeframe}
            options={options(timeframeLabel)}
            onChange={(event) =>
              change({ timeframe: event.target.value as StrategyFilterValues["timeframe"] })
            }
          />
          <Select
            label="Tested"
            value={draft.tested}
            options={[
              { value: "all", label: "All" },
              { value: "tested", label: "Tested" },
              { value: "untested", label: "Not tested yet" },
            ]}
            onChange={(event) =>
              change({ tested: event.target.value as StrategyFilterValues["tested"] })
            }
          />
          <Input
            label="Min best CAGR %"
            type="number"
            step="any"
            value={draft.minBestCagr}
            onChange={(event) => setDraft({ ...draft, minBestCagr: event.target.value })}
          />
        </div>
      )}
    </div>
  );
}
