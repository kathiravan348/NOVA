import type { MarketHoursMode } from "@nova/contracts";
import { Card, Select, Skeleton, useToast } from "@nova/ui-core";
import { getDataMode, useDownloadSettings, useUpdateDownloadSettings } from "@nova/services";
import { QueryError } from "../../components/QueryState";

const options: { value: MarketHoursMode; label: string }[] = [
  { value: "slow", label: "Slow down (1 request a second)" },
  { value: "full", label: "Full pace (2 requests a second)" },
];

/** Download pace on weekdays 09:15–15:30 IST (D57 (5)); Pause always works as well. */
export function PaceSetting() {
  const toast = useToast();
  const settings = useDownloadSettings();
  const update = useUpdateDownloadSettings();

  const save = async (mode: MarketHoursMode) => {
    try {
      await update.mutateAsync({ marketHoursMode: mode });
      toast.show({
        title: `Download pace saved${getDataMode() === "mock" ? " (demo)" : ""}`,
        description: mode === "slow" ? "Slower during market hours." : "Full pace all day.",
        tone: "success",
      });
    } catch (err) {
      toast.show({
        title: "Could not save the pace",
        description: err instanceof Error ? err.message : undefined,
        tone: "danger",
      });
    }
  };

  return (
    <Card title="Download pace">
      {settings.isPending ? (
        <Skeleton className="h-10 w-full" />
      ) : settings.isError ? (
        <QueryError error={settings.error} onRetry={() => void settings.refetch()} />
      ) : (
        <Select
          label="In market hours (09:15–15:30)"
          description="Slowing down leaves Kite room for live prices while the market is open."
          options={options}
          value={settings.data.marketHoursMode}
          disabled={update.isPending}
          onChange={(e) => void save(e.target.value as MarketHoursMode)}
        />
      )}
    </Card>
  );
}
