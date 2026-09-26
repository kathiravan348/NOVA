import { useState } from "react";
import { UniverseEntryWriteSchema, type IndexName, type UniverseEntry } from "@nova/contracts";
import { Button, Checkbox, Input, Modal, useToast } from "@nova/ui-core";
import {
  getDataMode,
  useCreateUniverseEntry,
  useMarketIndices,
  useUpdateUniverseEntry,
} from "@nova/services";

export interface UniverseEntryModalProps {
  /** `null` = add a new stock; an entry = edit it. */
  entry: UniverseEntry | null;
  open: boolean;
  onClose: () => void;
}

/** Add or edit one stock of the list (D54). The symbol is fixed once added. */
export function UniverseEntryModal({ entry, open, onClose }: UniverseEntryModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={entry ? `Edit ${entry.symbol}` : "Add stock"}
      description={
        entry
          ? "Change how the stock is described. The symbol stays."
          : "Use the NSE symbol, e.g. INFY. Then press Sync with Kite before downloading."
      }
    >
      {open && <EntryForm entry={entry} onDone={onClose} />}
    </Modal>
  );
}

function EntryForm({ entry, onDone }: { entry: UniverseEntry | null; onDone: () => void }) {
  const toast = useToast();
  const create = useCreateUniverseEntry();
  const update = useUpdateUniverseEntry();
  const known = useMarketIndices();
  const [symbol, setSymbol] = useState(entry?.symbol ?? "");
  const [name, setName] = useState(entry?.name ?? "");
  const [sector, setSector] = useState(entry?.sector ?? "");
  const [indices, setIndices] = useState<IndexName[]>(entry?.indices ?? []);
  const [touched, setTouched] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const body = { symbol: symbol.trim().toUpperCase(), name, sector, indices };
  const parsed = UniverseEntryWriteSchema.safeParse(body);
  const fieldError = (field: "symbol" | "name" | "sector"): string | undefined =>
    touched && !parsed.success
      ? parsed.error.issues.find((issue) => issue.path[0] === field)?.message
      : undefined;
  const toggle = (index: IndexName, on: boolean) =>
    setIndices((current) => (on ? [...current, index] : current.filter((i) => i !== index)));

  const save = async () => {
    if (!parsed.success) return;
    setFailed(null);
    try {
      const saved = await (entry ? update : create).mutateAsync(parsed.data);
      const demo = getDataMode() === "mock";
      toast.show({
        title: `${entry ? "Stock updated" : "Stock added"}${demo ? " (demo)" : ""}`,
        description: demo ? "Mock mode does not store it." : `${saved.symbol} · ${saved.name}`,
        tone: "success",
      });
      onDone();
    } catch (err) {
      setFailed(err instanceof Error ? err.message : "Could not save the stock");
    }
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        void save();
      }}
    >
      <Input
        label="Symbol"
        description="As on NSE: capital letters, digits, & or -."
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        readOnly={entry !== null}
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
        error={fieldError("symbol")}
      />
      <Input
        label="Name"
        maxLength={80}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldError("name")}
      />
      <Input
        label="Sector"
        description="e.g. Financial Services, Information Technology."
        maxLength={80}
        value={sector}
        onChange={(e) => setSector(e.target.value)}
        error={fieldError("sector")}
      />
      <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <legend className="mb-1 text-body-sm font-medium text-text-primary">Indices</legend>
        {known.isPending && <p className="text-body-sm text-text-muted">Loading indices…</p>}
        {known.isError && (
          <p role="alert" className="text-body-sm text-loss">
            Could not load the indices.
          </p>
        )}
        {indexChoices(known.data?.map((i) => i.name) ?? [], indices).map((index) => (
          <Checkbox
            key={index}
            label={index}
            checked={indices.includes(index)}
            onCheckedChange={(checked) => toggle(index, checked === true)}
          />
        ))}
      </fieldset>
      {failed && (
        <p role="alert" className="text-body-sm text-loss">
          {failed}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={create.isPending || update.isPending}>
          {entry ? "Save" : "Add stock"}
        </Button>
      </div>
    </form>
  );
}

/** Every known index, plus any the stock already has that the list no longer shows. */
function indexChoices(known: IndexName[], chosen: IndexName[]): IndexName[] {
  return [...known, ...chosen.filter((name) => !known.includes(name))];
}
