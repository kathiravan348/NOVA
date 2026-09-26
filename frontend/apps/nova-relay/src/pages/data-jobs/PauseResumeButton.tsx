import type { DataJob } from "@nova/contracts";
import { Button, useToast } from "@nova/ui-core";
import { getDataMode, useChangeDataJob, type JobAction } from "@nova/services";

const ACTION: Record<string, { action: JobAction; label: string; done: string; note: string }> = {
  draft: {
    action: "start",
    label: "Start",
    done: "Download started",
    note: "It runs after the jobs ahead.",
  },
  queued: { action: "pause", label: "Pause", done: "Download paused", note: "Saved steps stay." },
  running: {
    action: "pause",
    label: "Pause",
    done: "Download paused",
    note: "It stops after the current step; saved steps stay.",
  },
  paused: {
    action: "resume",
    label: "Resume",
    done: "Download resumed",
    note: "It continues from the next step.",
  },
};

/** **Start** a planned download, **Pause** a waiting or running one, **Resume** a paused one (D57). */
export function PauseResumeButton({ job }: { job: DataJob }) {
  const toast = useToast();
  const change = useChangeDataJob();
  const entry = job.type === "historical_download" ? ACTION[job.status] : undefined;
  if (!entry) return null;

  const run = async () => {
    try {
      await change.mutateAsync({ jobId: job.id, action: entry.action });
      const demo = getDataMode() === "mock";
      toast.show({
        title: demo ? `${entry.done} (demo)` : entry.done,
        description: demo ? "Mock mode changes nothing." : entry.note,
        tone: "success",
      });
    } catch (err) {
      toast.show({
        title: `Could not ${entry.label.toLowerCase()} the download`,
        description: err instanceof Error ? err.message : undefined,
        tone: "danger",
      });
    }
  };

  return (
    <Button
      size="sm"
      variant={entry.action === "start" ? "primary" : "secondary"}
      disabled={change.isPending}
      onClick={() => void run()}
    >
      {entry.label}
    </Button>
  );
}
