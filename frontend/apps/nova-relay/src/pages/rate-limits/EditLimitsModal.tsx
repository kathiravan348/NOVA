import { useState } from "react";
import type { RateLimit } from "@nova/contracts";
import { Button, Input, Modal, useToast } from "@nova/ui-core";
import { formatQuantity } from "@nova/ui-trading";
import { useUpdateRateLimit } from "@nova/services";
import { endpointLabel } from "../../lib/labels";
import { OWN_LIMIT_LABEL, windowLabel } from "../../lib/rateLimits";

export interface EditLimitsModalProps {
  accountLabel: string;
  limit: RateLimit | null;
  onClose: () => void;
}

/** Edits the own (safety) limits of one account + endpoint; broker limits are read-only (R3). */
export function EditLimitsModal({ accountLabel, limit, onClose }: EditLimitsModalProps) {
  return (
    <Modal
      open={limit !== null}
      onOpenChange={(open) => !open && onClose()}
      title={limit ? `Edit limits · ${endpointLabel[limit.endpoint]}` : "Edit limits"}
      description={`${accountLabel}. Broker limits are set by the broker and cannot be raised here.`}
    >
      {limit && <LimitsForm key={limit.endpoint} limit={limit} onDone={onClose} />}
    </Modal>
  );
}

function LimitsForm({ limit, onDone }: { limit: RateLimit; onDone: () => void }) {
  const toast = useToast();
  const update = useUpdateRateLimit();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(limit.rules.map((r) => [r.window, String(r.novaLimit)])),
  );
  const [failed, setFailed] = useState<string | null>(null);

  const errorOf = (window: string, brokerLimit: number): string | undefined => {
    const n = Number(values[window]);
    if (!Number.isInteger(n) || n < 1) return "Whole number, at least 1";
    if (n > brokerLimit) return `At most the broker limit (${formatQuantity(brokerLimit)})`;
    return undefined;
  };
  const invalid = limit.rules.some((r) => errorOf(r.window, r.brokerLimit));

  const save = async () => {
    setFailed(null);
    const changed = limit.rules.filter((r) => Number(values[r.window]) !== r.novaLimit);
    try {
      for (const r of changed) {
        await update.mutateAsync({
          accountId: limit.accountId,
          endpoint: limit.endpoint,
          window: r.window,
          novaLimit: Number(values[r.window]),
        });
      }
    } catch (err) {
      setFailed(err instanceof Error ? err.message : "Could not save the limits");
      return;
    }
    toast.show({
      title: changed.length > 0 ? "Limits saved (demo)" : "No changes",
      description:
        changed.length > 0
          ? "Stage A does not store them; Stage B records this in the audit log."
          : undefined,
      tone: changed.length > 0 ? "success" : "neutral",
    });
    onDone();
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!invalid) void save();
      }}
    >
      {limit.rules.map((r) => (
        <Input
          key={r.window}
          label={`${OWN_LIMIT_LABEL} · ${windowLabel[r.window].toLowerCase()}`}
          description={`Broker limit ${formatQuantity(r.brokerLimit)}`}
          inputMode="numeric"
          numeric
          value={values[r.window] ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, [r.window]: e.target.value }))}
          error={errorOf(r.window, r.brokerLimit)}
        />
      ))}
      {failed && (
        <p role="alert" className="text-body-sm text-loss">
          {failed}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={invalid || update.isPending}>
          Save limits
        </Button>
      </div>
    </form>
  );
}
