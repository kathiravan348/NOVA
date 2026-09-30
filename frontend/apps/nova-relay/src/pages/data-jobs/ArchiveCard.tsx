import { useState } from "react";
import { Link } from "react-router";
import { Button, Card } from "@nova/ui-core";
import { ArchiveModal } from "./ArchiveModal";

/** Tick archive (D54): moves old live prices out of the database. Recording itself lives under Live. */
export function ArchiveCard() {
  const [archiving, setArchiving] = useState(false);
  return (
    <Card title="Tick archive">
      <div className="flex flex-col gap-3">
        <p className="text-body-sm text-text-secondary">
          Move old live prices into files to keep the database small. Nothing is lost. Recording
          lives under{" "}
          <Link to="/live/config" className="text-action-text hover:underline">
            Live → Config
          </Link>
          .
        </p>
        <div>
          <Button size="sm" variant="secondary" onClick={() => setArchiving(true)}>
            Archive old ticks
          </Button>
        </div>
      </div>
      <ArchiveModal open={archiving} onClose={() => setArchiving(false)} />
    </Card>
  );
}
