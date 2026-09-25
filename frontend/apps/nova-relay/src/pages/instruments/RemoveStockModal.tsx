import { useState } from "react";
import { Button, Modal, useToast } from "@nova/ui-core";
import { getDataMode, useDeleteUniverseEntry } from "@nova/services";

export interface RemoveStockModalProps {
  symbol: string | null;
  onClose: () => void;
}

/** Confirms removing a stock from the list (D54); its downloaded prices stay. */
export function RemoveStockModal({ symbol, onClose }: RemoveStockModalProps) {
  const toast = useToast();
  const remove = useDeleteUniverseEntry();
  const [failed, setFailed] = useState<string | null>(null);

  const close = () => {
    setFailed(null);
    onClose();
  };

  const confirm = async () => {
    if (!symbol) return;
    setFailed(null);
    try {
      await remove.mutateAsync(symbol);
      const demo = getDataMode() === "mock";
      toast.show({
        title: demo ? "Stock removed (demo)" : "Stock removed",
        description: demo ? "Mock mode changes nothing." : `${symbol} is no longer in the list.`,
        tone: "success",
      });
      close();
    } catch (err) {
      setFailed(err instanceof Error ? err.message : "Could not remove the stock");
    }
  };

  return (
    <Modal
      open={symbol !== null}
      onOpenChange={(next) => !next && close()}
      title={`Remove ${symbol ?? ""} from the list?`}
      description="Its downloaded prices stay. You can add it again later."
    >
      <div className="flex flex-col gap-4">
        {failed && (
          <p role="alert" className="text-body-sm text-loss">
            {failed}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={close}>
            Keep it
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={remove.isPending}
            onClick={() => void confirm()}
          >
            Remove
          </Button>
        </div>
      </div>
    </Modal>
  );
}
