import { useState } from "react";
import { Link } from "react-router";
import { Button, Card, Skeleton, StatusBadge, Switch, useToast } from "@nova/ui-core";
import { getDataMode, useRecorder, useUpdateRecorder } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { recorderStateLabel, recorderStateTone } from "../../lib/labels";
import { RecorderSymbolsModal } from "./RecorderSymbolsModal";
import { RecorderIndicesModal } from "./RecorderIndicesModal";

/** Recording (D54, D74): the switch, its state and the stocks to record. */
export function RecorderCard() {
  const toast = useToast();
  const recorder = useRecorder();
  const update = useUpdateRecorder();
  const [choosing, setChoosing] = useState(false);
  const [choosingIndices, setChoosingIndices] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  if (recorder.isPending) return <Skeleton className="h-40 w-full" />;
  if (recorder.isError) {
    return <QueryError error={recorder.error} onRetry={() => void recorder.refetch()} />;
  }
  const settings = recorder.data;

  const turn = async (enabled: boolean) => {
    setFailed(null);
    try {
      await update.mutateAsync({ enabled, symbols: settings.symbols });
      const demo = getDataMode() === "mock" ? " (demo)" : "";
      toast.show({
        title: enabled ? `Recording switched on${demo}` : `Recording switched off${demo}`,
        description: enabled ? "It records every weekday from 09:15 to 15:30." : undefined,
        tone: "success",
      });
    } catch (err) {
      setFailed(err instanceof Error ? err.message : "Could not change the recording");
    }
  };

  const stocks = settings.symbols.length
    ? `${settings.symbols.length.toLocaleString("en-IN")} chosen ${settings.symbols.length === 1 ? "stock" : "stocks"}`
    : "All stocks synced with Kite";
  const indices = settings.indices.length ? `${settings.indices.length} indices` : "no indices";

  return (
    <Card title="Live recording">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Switch
            label="Record live prices"
            checked={settings.enabled}
            disabled={update.isPending}
            onCheckedChange={(on) => void turn(on)}
          />
          <StatusBadge
            tone={recorderStateTone[settings.state]}
            label={recorderStateLabel[settings.state]}
          />
          {settings.jobId && (
            <Link
              to={`/data-jobs/${settings.jobId}`}
              className="text-body-sm text-action-text hover:underline"
            >
              Open today&apos;s recording
            </Link>
          )}
        </div>
        <p className="text-body-sm text-text-secondary">
          Records every weekday 09:15–15:30 while on. Prices before today cannot be recorded later.
        </p>
        {failed && (
          <p role="alert" className="text-body-sm text-loss">
            {failed}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-body-sm text-text-primary">
            {stocks} + {indices}
          </span>
          <Button size="sm" variant="secondary" onClick={() => setChoosing(true)}>
            Choose stocks
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setChoosingIndices(true)}>
            Choose indices
          </Button>
        </div>
      </div>
      <RecorderSymbolsModal
        open={choosing}
        settings={settings}
        onClose={() => setChoosing(false)}
      />
      <RecorderIndicesModal
        open={choosingIndices}
        settings={settings}
        onClose={() => setChoosingIndices(false)}
      />
    </Card>
  );
}
