import { Link } from "react-router";
import { TriangleAlert } from "lucide-react";
import { Card } from "@nova/ui-core";
import { useRecorder } from "@nova/services";

/** Shown while live recording is on but has no Kite session in market hours (D54). */
export function RecorderWaiting() {
  const recorder = useRecorder();
  if (recorder.data?.state !== "no_login") return null;
  return (
    <Card className="border-warning">
      <p className="flex items-center gap-2 text-body text-text-primary">
        <TriangleAlert className="h-5 w-5 shrink-0 text-warning-text" aria-hidden="true" />
        <span>
          Live price recording is waiting for today&apos;s Kite login.{" "}
          <Link to="/data-jobs" className="text-action-text hover:underline">
            Open data jobs
          </Link>
        </span>
      </p>
    </Card>
  );
}
