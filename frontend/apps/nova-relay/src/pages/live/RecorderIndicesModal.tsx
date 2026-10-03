import { useState } from "react";
import { MAX_RECORDER_SYMBOLS, type RecorderSettings } from "@nova/contracts";
import { Button, Checkbox, Modal, Skeleton, useToast } from "@nova/ui-core";
import { getDataMode, useMarketIndices, useUpdateRecorder } from "@nova/services";
import { QueryError } from "../../components/QueryState";

export interface RecorderIndicesModalProps {
  open: boolean;
  settings: RecorderSettings;
  onClose: () => void;
}

export function RecorderIndicesModal({ open, settings, onClose }: RecorderIndicesModalProps) {
  return (
    <Modal open={open} onOpenChange={(next) => !next && onClose()} title="Indices to record">
      {open && <IndicesForm settings={settings} onDone={onClose} />}
    </Modal>
  );
}

function IndicesForm({ settings, onDone }: { settings: RecorderSettings; onDone: () => void }) {
  const marketIndices = useMarketIndices();
  const update = useUpdateRecorder();
  const toast = useToast();
  const [indices, setIndices] = useState(settings.indices);
  const [failed, setFailed] = useState<string | null>(null);
  const stocks = settings.symbols.length;
  const total = stocks + indices.length;
  const tooMany = total > MAX_RECORDER_SYMBOLS;
  const format = (value: number) => value.toLocaleString("en-IN");

  const save = async () => {
    if (tooMany) return;
    setFailed(null);
    try {
      await update.mutateAsync({ enabled: settings.enabled, symbols: settings.symbols, indices });
      toast.show({
        title: `Indices saved${getDataMode() === "mock" ? " (demo)" : ""}`,
        description:
          indices.length === 0
            ? "No indices"
            : `${indices.length} ${indices.length === 1 ? "index" : "indices"}`,
        tone: "success",
      });
      onDone();
    } catch (err) {
      setFailed(err instanceof Error ? err.message : "Could not save the indices");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body-sm text-text-secondary">
        Index prices give backtests the market direction. They use a few of the 3,000 slots.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={marketIndices.isPending || marketIndices.isError}
          onClick={() => setIndices((marketIndices.data ?? []).map((index) => index.name))}
        >
          Select all
        </Button>
        <Button type="button" variant="secondary" onClick={() => setIndices([])}>
          Clear
        </Button>
      </div>
      {marketIndices.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : marketIndices.isError ? (
        <QueryError error={marketIndices.error} onRetry={() => void marketIndices.refetch()} />
      ) : (
        <div className="flex flex-col gap-3">
          {marketIndices.data.map((index) => (
            <Checkbox
              key={index.name}
              label={`${index.name} (${index.members} members)`}
              checked={indices.includes(index.name)}
              onCheckedChange={(checked) =>
                setIndices((chosen) =>
                  checked ? [...chosen, index.name] : chosen.filter((name) => name !== index.name),
                )
              }
            />
          ))}
        </div>
      )}
      <p className="text-body-sm text-text-primary">
        {stocks === 0
          ? // No chosen stocks means every synced stock (D54): Kite's limit is checked on save.
            "Stocks: every stock synced with Kite. Choose stocks first to leave room for indices."
          : `Stocks + indices: ${format(stocks)} + ${format(indices.length)} = ${format(total)} of 3,000`}
      </p>
      {(tooMany || failed) && (
        <p role="alert" className="text-body-sm text-loss">
          {tooMany ? "Kite streams at most 3000 instruments: remove stocks or indices" : failed}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={update.isPending || marketIndices.isPending || marketIndices.isError || tooMany}
          onClick={() => void save()}
        >
          Save indices
        </Button>
      </div>
    </div>
  );
}
