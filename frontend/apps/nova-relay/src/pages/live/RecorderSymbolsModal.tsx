import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { MAX_RECORDER_SYMBOLS, type RecorderSettings, type UniverseEntry } from "@nova/contracts";
import { Button, Modal, useToast } from "@nova/ui-core";
import { getDataMode, useInstruments, useUniverse, useUpdateRecorder } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { BulkStockPicker } from "../data-jobs/BulkStockPicker";
import { topByTradedValue } from "./topByTradedValue";

const columns: ColumnDef<UniverseEntry, unknown>[] = [
  { id: "symbol", header: "Symbol", accessorKey: "symbol", meta: { primary: true } },
  { id: "name", header: "Name", accessorKey: "name" },
];

export interface RecorderSymbolsModalProps {
  open: boolean;
  settings: RecorderSettings;
  onClose: () => void;
}

/** Choose which synced stocks to record; none chosen = all of them (D54). */
export function RecorderSymbolsModal({ open, settings, onClose }: RecorderSymbolsModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Stocks to record"
      description="Tick the stocks to record. Leave all unticked to record every stock synced with Kite."
    >
      {open && <SymbolsForm settings={settings} onDone={onClose} />}
    </Modal>
  );
}

function SymbolsForm({ settings, onDone }: { settings: RecorderSettings; onDone: () => void }) {
  const toast = useToast();
  const universe = useUniverse();
  const instruments = useInstruments();
  const update = useUpdateRecorder();
  const [symbols, setSymbols] = useState<string[]>(settings.symbols);
  const [failed, setFailed] = useState<string | null>(null);
  const tooMany = symbols.length > MAX_RECORDER_SYMBOLS;
  const synced = (universe.data ?? []).filter((e) => e.synced);

  const pickTop = () =>
    setSymbols(
      topByTradedValue(
        synced.map((e) => e.symbol),
        instruments.data ?? [],
        MAX_RECORDER_SYMBOLS,
      ),
    );

  const save = async () => {
    if (tooMany) return;
    setFailed(null);
    try {
      await update.mutateAsync({ enabled: settings.enabled, symbols });
      toast.show({
        title: `Stocks saved${getDataMode() === "mock" ? " (demo)" : ""}`,
        description: symbols.length ? `${symbols.length} stocks` : "All synced stocks",
        tone: "success",
      });
      onDone();
    } catch (err) {
      setFailed(err instanceof Error ? err.message : "Could not save the stocks");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={universe.isPending || instruments.isPending || instruments.isError}
          onClick={pickTop}
        >
          Pick top {MAX_RECORDER_SYMBOLS} by traded value
        </Button>
        <p className="text-body-sm text-text-secondary">
          Ranked by 20-day average volume × last close; stocks with no history rank last.
        </p>
        {instruments.isError && (
          <QueryError error={instruments.error} onRetry={() => void instruments.refetch()} />
        )}
      </div>
      <BulkStockPicker
        caption="Stocks to record"
        columns={columns}
        entries={synced}
        selected={symbols}
        onChange={setSymbols}
        loading={universe.isPending}
        error={
          universe.isError ? (
            <QueryError error={universe.error} onRetry={() => void universe.refetch()} />
          ) : undefined
        }
        pageSize={8}
      />
      {(failed !== null || tooMany) && (
        <p role="alert" className="text-body-sm text-loss">
          {tooMany ? `Kite streams at most ${MAX_RECORDER_SYMBOLS} stocks` : failed}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="button" disabled={update.isPending} onClick={() => void save()}>
          Save stocks
        </Button>
      </div>
    </div>
  );
}
