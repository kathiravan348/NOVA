import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { MAX_RECORDER_SYMBOLS, type RecorderSettings, type UniverseEntry } from "@nova/contracts";
import { Button, DataTable, Modal, useToast } from "@nova/ui-core";
import { getDataMode, useUniverse, useUpdateRecorder } from "@nova/services";
import { QueryError } from "../../components/QueryState";

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
  const update = useUpdateRecorder();
  const [symbols, setSymbols] = useState<string[]>(settings.symbols);
  const [failed, setFailed] = useState<string | null>(null);
  const tooMany = symbols.length > MAX_RECORDER_SYMBOLS;

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
      <DataTable
        caption="Stocks to record"
        columns={columns}
        data={(universe.data ?? []).filter((e) => e.synced)}
        getRowId={(e) => e.symbol}
        loading={universe.isPending}
        error={
          universe.isError ? (
            <QueryError error={universe.error} onRetry={() => void universe.refetch()} />
          ) : undefined
        }
        selectedIds={symbols}
        onSelectedIdsChange={setSymbols}
        search={{
          label: "Search stocks",
          placeholder: "Symbol or name",
          getText: (e) => `${e.symbol} ${e.name}`,
        }}
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
