import { Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import { Button, useToast } from "@nova/ui-core";
import { useDeleteStrategy, useStrategyStats } from "@nova/services";
import { ConfirmDelete, useFailToast } from "../backtests/DeleteBacktestButton";

const backtestsText = (count: number) => (count === 1 ? "1 backtest" : `${count} backtests`);

/** Deletes a strategy with every version and backtest of it, after a confirm (D62). */
export function DeleteStrategyButton({ strategyId, name }: { strategyId: string; name: string }) {
  const toast = useToast();
  const fail = useFailToast();
  const navigate = useNavigate();
  const remove = useDeleteStrategy();
  const stats = useStrategyStats().data?.find((s) => s.strategyId === strategyId);
  const runs = stats ? backtestsText(stats.runsTotal) : "its backtests";
  return (
    <ConfirmDelete
      question={`Delete ${name}?`}
      detail={`This cannot be undone. All its versions and ${runs} are deleted too.`}
      pending={remove.isPending}
      trigger={(open) => (
        <Button variant="danger" size="sm" onClick={open}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete strategy
        </Button>
      )}
      onConfirm={(close) =>
        remove.mutate(strategyId, {
          onSuccess: () => {
            close();
            toast.show({ title: `Deleted ${name}`, tone: "success" });
            void navigate("/strategies");
          },
          onError: fail,
        })
      }
    />
  );
}
