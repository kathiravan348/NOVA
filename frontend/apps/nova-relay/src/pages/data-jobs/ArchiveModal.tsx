import { useState } from "react";
import { useNavigate } from "react-router";
import { Button, DateTimePicker, Modal, useToast } from "@nova/ui-core";
import { getDataMode, useCreateArchiveJob } from "@nova/services";
import { istDaysAgo, todayIst } from "../../lib/format";

export interface ArchiveModalProps {
  open: boolean;
  onClose: () => void;
}

/** Queue moving old live prices from the database to files (D54). */
export function ArchiveModal({ open, onClose }: ArchiveModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Archive old ticks"
      description="Moves older live prices from the database to files. Nothing is lost."
    >
      {open && <ArchiveForm onDone={onClose} />}
    </Modal>
  );
}

function problemWith(before: string): string | undefined {
  if (!before) return "Choose a date";
  if (before > todayIst()) return "The date can't be in the future";
  return undefined;
}

function ArchiveForm({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const archive = useCreateArchiveJob();
  const [before, setBefore] = useState(istDaysAgo(30));
  const [failed, setFailed] = useState<string | null>(null);
  const problem = problemWith(before);

  const submit = async () => {
    if (problem) return;
    setFailed(null);
    try {
      const job = await archive.mutateAsync({ before });
      const demo = getDataMode() === "mock";
      toast.show({
        title: demo ? "Archive queued (demo)" : "Archive queued",
        description: demo ? "Mock mode moves nothing." : `${job.symbols.length} stock(s).`,
        tone: "success",
      });
      onDone();
      if (!demo) void navigate(`/data-jobs/${job.id}`);
    } catch (err) {
      setFailed(err instanceof Error ? err.message : "Could not queue the archive");
    }
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <DateTimePicker
        mode="date"
        label="Move ticks before"
        max={todayIst()}
        value={before}
        onChange={(v) => setBefore(v ?? "")}
        error={problem}
      />
      {failed && (
        <p role="alert" className="text-body-sm text-loss">
          {failed}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={archive.isPending || Boolean(problem)}>
          Queue archive
        </Button>
      </div>
    </form>
  );
}
