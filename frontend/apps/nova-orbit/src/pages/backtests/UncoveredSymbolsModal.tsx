import { Button, Modal } from "@nova/ui-core";

/** Asks to drop the chosen symbols whose downloaded data does not cover the period (R2). */
export function UncoveredSymbolsModal({
  symbols,
  onCancel,
  onDrop,
}: {
  symbols: string[];
  onCancel: () => void;
  onDrop: () => void;
}) {
  return (
    <Modal
      open={symbols.length > 0}
      onOpenChange={(open) => !open && onCancel()}
      title="Some symbols have no data for this period"
      description="A backtest needs data for the whole period. Drop these symbols and queue?"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Go back
          </Button>
          <Button onClick={onDrop}>Drop and queue</Button>
        </>
      }
    >
      <p className="font-mono text-body text-text-primary">{symbols.join(", ")}</p>
    </Modal>
  );
}
