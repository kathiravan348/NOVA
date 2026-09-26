import { useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Button, IconButton, Modal, useToast } from "@nova/ui-core";
import { useDeleteBacktest, useDeleteBacktests } from "@nova/services";

interface ConfirmDeleteProps {
  /** What the Modal asks, e.g. "Delete IT basket and all its versions?" */
  question: string;
  /** Opens the Modal. */
  trigger: (open: () => void) => ReactNode;
  pending: boolean;
  onConfirm: (close: () => void) => void;
}

/** A delete control with a "cannot be undone" confirm (D60). */
function ConfirmDelete({ question, trigger, pending, onConfirm }: ConfirmDeleteProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {trigger(() => setOpen(true))}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={question}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Keep it
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={pending}
              onClick={() => onConfirm(() => setOpen(false))}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-body text-text-secondary">
          This cannot be undone. Trades and results are deleted too.
        </p>
      </Modal>
    </>
  );
}

function useFailToast() {
  const toast = useToast();
  return (err: Error) =>
    toast.show({ title: "Could not delete", description: err.message, tone: "danger" });
}

/** Deletes a whole backtest (every version), or with `scope="version"` one older version. */
export function DeleteBacktestButton({
  runId,
  name,
  version,
  scope = "all",
  onDeleted,
}: {
  runId: string;
  name: string;
  version?: number;
  scope?: "all" | "version";
  onDeleted?: () => void;
}) {
  const toast = useToast();
  const fail = useFailToast();
  const remove = useDeleteBacktest();
  const question =
    scope === "version"
      ? `Delete v${version ?? ""} of ${name}?`
      : `Delete ${name} and all its versions?`;
  return (
    <ConfirmDelete
      question={question}
      pending={remove.isPending}
      trigger={(open) =>
        scope === "version" ? (
          <IconButton
            variant="ghost"
            size="sm"
            aria-label={`Delete v${version ?? ""}`}
            icon={<Trash2 className="h-4 w-4" />}
            onClick={open}
          />
        ) : (
          <Button variant="danger" size="sm" onClick={open}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </Button>
        )
      }
      onConfirm={(close) =>
        remove.mutate(
          { runId, scope },
          {
            onSuccess: ({ deletedRuns }) => {
              close();
              toast.show({
                title: "Backtest deleted",
                description: `${deletedRuns} run${deletedRuns === 1 ? "" : "s"} removed.`,
                tone: "success",
              });
              onDeleted?.();
            },
            onError: fail,
          },
        )
      }
    />
  );
}

/** Deletes every selected backtest with all its versions (the Backtests list). */
export function DeleteSelectedButton({ ids, onDeleted }: { ids: string[]; onDeleted: () => void }) {
  const toast = useToast();
  const fail = useFailToast();
  const remove = useDeleteBacktests();
  const count = ids.length;
  return (
    <ConfirmDelete
      question={`Delete ${count} backtest${count === 1 ? "" : "s"} and all their versions?`}
      pending={remove.isPending}
      trigger={(open) => (
        <Button variant="danger" size="sm" disabled={count === 0} onClick={open}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete selected ({count})
        </Button>
      )}
      onConfirm={(close) =>
        remove.mutate(ids, {
          onSuccess: ({ deletedRuns }) => {
            close();
            toast.show({
              title: "Backtests deleted",
              description: `${deletedRuns} run${deletedRuns === 1 ? "" : "s"} removed.`,
              tone: "success",
            });
            onDeleted();
          },
          onError: fail,
        })
      }
    />
  );
}
