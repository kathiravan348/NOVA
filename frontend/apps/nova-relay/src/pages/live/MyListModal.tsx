import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { UniverseEntry } from "@nova/contracts";
import { Button, Modal } from "@nova/ui-core";
import { useUniverse } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { BulkStockPicker } from "../data-jobs/BulkStockPicker";

const columns: ColumnDef<UniverseEntry, unknown>[] = [
  { id: "symbol", header: "Symbol", accessorKey: "symbol", meta: { primary: true } },
  { id: "name", header: "Name", accessorKey: "name" },
];

export interface MyListModalProps {
  open: boolean;
  symbols: string[];
  onClose: () => void;
  onSave: (symbols: string[]) => void;
}

/** Pick the stocks of My list on the Monitor (D78). */
export function MyListModal({ open, symbols, onClose, onSave }: MyListModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="My list"
      description="Tick the stocks to watch on the Monitor. The list is saved in this browser."
    >
      {open && <ListForm initial={symbols} onCancel={onClose} onSave={onSave} />}
    </Modal>
  );
}

function ListForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: string[];
  onCancel: () => void;
  onSave: (symbols: string[]) => void;
}) {
  const universe = useUniverse();
  const [symbols, setSymbols] = useState<string[]>(initial);
  return (
    <div className="flex flex-col gap-4">
      <BulkStockPicker
        caption="Stocks in my list"
        columns={columns}
        entries={universe.data ?? []}
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
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={() => onSave(symbols)}>
          Save list
        </Button>
      </div>
    </div>
  );
}
