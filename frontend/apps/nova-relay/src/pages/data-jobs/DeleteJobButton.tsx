import { useState } from "react";
import { useNavigate } from "react-router";
import type { DataJob } from "@nova/contracts";
import { Button, Checkbox, Modal, useToast } from "@nova/ui-core";
import { formatQuantity } from "@nova/ui-trading";
import { getDataMode, useDeleteDataJob } from "@nova/services";

/** Statuses a job can be deleted in (NOVA-095): planned or finished, never while it may run. */
export const DELETABLE: DataJob["status"][] = ["draft", "completed", "failed", "cancelled"];

/** **Delete job** with a confirmation; a download can take its candles with it (NOVA-096). */
export function DeleteJobButton({ job }: { job: DataJob }) {
  const toast = useToast();
  const navigate = useNavigate();
  const remove = useDeleteDataJob();
  const [open, setOpen] = useState(false);
  const [candles, setCandles] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const isDownload = job.type === "historical_download";

  const confirm = async () => {
    setFailed(null);
    try {
      const result = await remove.mutateAsync({ jobId: job.id, candles: isDownload && candles });
      const demo = getDataMode() === "mock";
      toast.show({
        title: demo ? "Job deleted (demo)" : "Job deleted",
        description: demo
          ? "Mock mode changes nothing."
          : candles
            ? `${formatQuantity(result.candlesDeleted)} candles removed.`
            : "Its candles stay.",
        tone: "success",
      });
      setOpen(false);
      void navigate("/data-jobs");
    } catch (err) {
      setFailed(err instanceof Error ? err.message : "Could not delete the job");
    }
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Delete job
      </Button>
      <Modal
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setFailed(null);
            setCandles(false);
          }
        }}
        title="Delete this job?"
        description="The job leaves the list for good. The audit log keeps a line about it."
      >
        <div className="flex flex-col gap-4">
          {isDownload && (
            <Checkbox
              label="Also delete the candles it downloaded"
              description="Removes every candle of these stocks, timeframe and dates, including any another job saved there."
              checked={candles}
              onCheckedChange={(value) => setCandles(value === true)}
            />
          )}
          {failed && (
            <p role="alert" className="text-body-sm text-loss">
              {failed}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Keep it
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={remove.isPending}
              onClick={() => void confirm()}
            >
              Delete job
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
