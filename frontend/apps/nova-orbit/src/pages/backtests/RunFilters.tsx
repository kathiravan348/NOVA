import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button, Input, Select, Switch } from "@nova/ui-core";
import { runStatusLabel, segmentLabel, timeframeLabel } from "../../lib/format";
import {
  EMPTY_FILTERS,
  NUMBER_RULES,
  SORT_LABELS,
  hasFilters,
  hasMoreFilters,
  numberValue,
  type RunFilterValues,
} from "./runFilters";

const TYPING_DELAY_MS = 400;
type TextKey = "q" | keyof typeof NUMBER_RULES;
const NUMBERS: [keyof typeof NUMBER_RULES, string, string][] = [
  ["minReturn", "Min return", "%"],
  ["minCagr", "Min CAGR", "%"],
  ["maxDrawdown", "Max drawdown", "%"],
  ["minWinRate", "Min win rate", "%"],
  ["minTrades", "Min trades", ""],
  ["minProfitFactor", "Min profit factor", ""],
];
const all = (label: string) => [{ value: "", label }];
const options = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

export interface RunFiltersProps {
  values: RunFilterValues;
  onChange: (values: RunFilterValues) => void;
  strategies: { id: string; name: string }[];
  /** Compare picks completed runs only (NOVA-172). */
  hideStatus?: boolean;
}

/**
 * Filters and sorting for backtest lists (D82 (6)). Typed values wait a moment before they apply,
 * so the list is not fetched on every key press.
 */
export function RunFilters({ values, onChange, strategies, hideStatus = false }: RunFiltersProps) {
  const [draft, setDraft] = useState(values);
  const [more, setMore] = useState(() => hasMoreFilters(values));
  useEffect(() => setDraft(values), [values]);
  useEffect(() => {
    if (hasMoreFilters(values)) setMore(true);
  }, [values]);
  useEffect(() => {
    const typed = (["q", ...NUMBERS.map(([key]) => key)] as TextKey[]).some(
      (key) => draft[key] !== values[key],
    );
    if (!typed) return;
    const timer = setTimeout(() => onChange(draft), TYPING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, values, onChange]);

  const pick = (change: Partial<RunFilterValues>) => onChange({ ...draft, ...change });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          label="Search"
          type="search"
          maxLength={200}
          placeholder="Backtest name"
          value={draft.q}
          onChange={(e) => setDraft({ ...draft, q: e.target.value })}
        />
        <Select
          label="Strategy"
          options={[
            ...all("All strategies"),
            ...strategies.map((s) => ({ value: s.id, label: s.name })),
          ]}
          value={draft.strategyId}
          onChange={(e) => pick({ strategyId: e.target.value })}
        />
        {!hideStatus && (
          <Select
            label="Status"
            options={[...all("Any status"), ...options(runStatusLabel)]}
            value={draft.status}
            onChange={(e) => pick({ status: e.target.value })}
          />
        )}
        <div className="flex items-end gap-3">
          <Select
            label="Sort by"
            containerClassName="flex-1"
            options={options(SORT_LABELS)}
            value={draft.sort}
            onChange={(e) => pick({ sort: e.target.value as RunFilterValues["sort"] })}
          />
          <Switch
            label="Ascending"
            checked={draft.ascending}
            onCheckedChange={(checked) => pick({ ascending: checked })}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={more}
          onClick={() => setMore((open) => !open)}
        >
          {more ? (
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )}
          More filters
        </Button>
        {hasFilters(values) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange({ ...EMPTY_FILTERS })}
          >
            Clear filters
          </Button>
        )}
      </div>
      {more && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Segment"
            options={[...all("Any segment"), ...options(segmentLabel)]}
            value={draft.segment}
            onChange={(e) => pick({ segment: e.target.value })}
          />
          <Select
            label="Timeframe"
            options={[...all("Any timeframe"), ...options(timeframeLabel)]}
            value={draft.timeframe}
            onChange={(e) => pick({ timeframe: e.target.value })}
          />
          {NUMBERS.map(([key, label, unit]) => {
            const text = draft[key];
            const bad = text.trim() !== "" && numberValue(key, text) === undefined;
            const [min, max] = NUMBER_RULES[key];
            return (
              <Input
                key={key}
                label={label}
                type="number"
                inputMode="decimal"
                numeric
                trailing={unit || undefined}
                min={Number.isFinite(min) ? min : undefined}
                max={Number.isFinite(max) ? max : undefined}
                step={key === "minTrades" ? 1 : "any"}
                value={text}
                error={bad ? "Not a valid number here" : undefined}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              />
            );
          })}
          <div className="flex items-end">
            <Switch
              label="Only profitable"
              checked={draft.profitable}
              onCheckedChange={(checked) => pick({ profitable: checked })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
