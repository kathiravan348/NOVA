import { useState } from "react";
import { Button, Modal, useToast } from "@nova/ui-core";
import { getDataMode, useCancelDataJob } from "@nova/services";

/** **Cancel job** with a confirmation (D54); a running download stops before its next chunk. */
export function CancelJobButton({ jobId }: { jobId: string }) {
  const toast = useToast();
  const cancel = useCancelDataJob();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const confirm = async () => {
    setFailed(null);
    try {
      await cancel.mutateAsync(jobId);
      const demo = getDataMode() === "mock";
      toast.show({
        title: demo ? "Job cancelled (demo)" : "Job cancelled",
        description: demo ? "Mock mode changes nothing." : "Rows already saved stay.",
        tone: "success",
      });
      setOpen(false);
    } catch (err) {
      setFailed(err instanceof Error ? err.message : "Could not cancel the job");
    }
  };

  return (
    <>
      <Button variant="secondary" size="sm" className="sm:ml-auto" onClick={() => setOpen(true)}>
        Cancel job
      </Button>
      <Modal
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setFailed(null);
        }}
        title="Cancel this job?"
        description="Rows already saved stay. You can queue the download again later."
      >
        <div className="flex flex-col gap-4">
          {failed && (
            <p role="alert" className="text-body-sm text-loss">
              {failed}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Keep running
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={cancel.isPending}
              onClick={() => void confirm()}
            >
              Cancel job
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
