import { useMemo, useState } from "react";
import type { SymbolBreakdown } from "@nova/contracts";
import { DataTable, Input, Modal, Select } from "@nova/ui-core";
import { symbolColumns } from "./SymbolBreakdown";

export interface SymbolsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: SymbolBreakdown[];
  onShowTrades: (symbol: string) => void;
}

export function SymbolsDialog({ open, onOpenChange, rows, onShowTrades }: SymbolsDialogProps) {
  const [search, setSearch] = useState("");
  const [show, setShow] = useState("all");
  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.symbol.toLowerCase().includes(search.trim().toLowerCase()) &&
          (show === "all" || (show === "winners" ? row.netPnlPaise > 0 : row.netPnlPaise < 0)),
      ),
    [rows, search, show],
  );
  const columns = symbolColumns((symbol) => {
    onOpenChange(false);
    onShowTrades(symbol);
  });
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="All symbol results" size="xl">
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Search"
            type="search"
            placeholder="Symbol"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select
            label="Show"
            value={show}
            onChange={(event) => setShow(event.target.value)}
            options={[
              { value: "all", label: "All" },
              { value: "winners", label: "Winners" },
              { value: "losers", label: "Losers" },
            ]}
          />
        </div>
        <DataTable
          caption="All symbol results"
          data={filtered}
          columns={columns}
          getRowId={(row) => row.symbol}
          pageSize={25}
          initialSort={[{ id: "net", desc: true }]}
          emptyState="No symbols match"
        />
      </div>
    </Modal>
  );
}
