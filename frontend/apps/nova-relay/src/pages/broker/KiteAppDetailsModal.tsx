import { useState } from "react";
import { type KiteApp, KiteAppUpdateSchema } from "@nova/contracts";
import { Button, Input, Modal, useToast } from "@nova/ui-core";
import { getDataMode, useUpdateKiteApp } from "@nova/services";

export interface KiteAppDetailsModalProps {
  app: KiteApp;
  open: boolean;
  onClose: () => void;
}

/** Plan, renewal date, postback URL and static IP of the account's Kite app (D55). */
export function KiteAppDetailsModal({ app, open, onClose }: KiteAppDetailsModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Edit Kite app details"
      description="For your reference; leave a field empty if it does not apply."
    >
      {open && <DetailsForm app={app} onDone={onClose} />}
    </Modal>
  );
}

type Field = "plan" | "subscriptionRenewsOn" | "postbackUrl" | "staticIp";

const orNull = (value: string) => (value.trim() === "" ? null : value.trim());

function DetailsForm({ app, onDone }: { app: KiteApp; onDone: () => void }) {
  const toast = useToast();
  const update = useUpdateKiteApp(app.accountId);
  const [values, setValues] = useState<Record<Field, string>>({
    plan: app.plan ?? "",
    subscriptionRenewsOn: app.subscriptionRenewsOn ?? "",
    postbackUrl: app.postbackUrl ?? "",
    staticIp: app.staticIp ?? "",
  });
  const [touched, setTouched] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const parsed = KiteAppUpdateSchema.safeParse({
    plan: orNull(values.plan),
    subscriptionRenewsOn: orNull(values.subscriptionRenewsOn),
    postbackUrl: orNull(values.postbackUrl),
    staticIp: orNull(values.staticIp),
  });
  const fieldError = (field: Field): string | undefined =>
    touched && !parsed.success
      ? parsed.error.issues.find((issue) => issue.path[0] === field)?.message
      : undefined;
  const set = (field: Field) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  const submit = async () => {
    if (!parsed.success) return;
    setFailed(null);
    try {
      await update.mutateAsync(parsed.data);
      toast.show({
        title: getDataMode() === "mock" ? "Details saved (demo)" : "Details saved",
        tone: "success",
      });
      onDone();
    } catch (err) {
      setFailed(err instanceof Error ? err.message : "Could not save the details");
    }
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        void submit();
      }}
    >
      <Input
        label="Plan"
        description="e.g. Kite Connect (paid, monthly)"
        maxLength={60}
        value={values.plan}
        onChange={set("plan")}
        error={fieldError("plan")}
      />
      <Input
        label="Renews on"
        type="date"
        value={values.subscriptionRenewsOn}
        onChange={set("subscriptionRenewsOn")}
        error={fieldError("subscriptionRenewsOn")}
      />
      <Input
        label="Postback URL"
        type="url"
        value={values.postbackUrl}
        onChange={set("postbackUrl")}
        error={fieldError("postbackUrl")}
      />
      <Input
        label="Static IP"
        description="Registered in the Kite console; needed for orders from Phase 3."
        inputMode="decimal"
        value={values.staticIp}
        onChange={set("staticIp")}
        error={fieldError("staticIp")}
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
        <Button type="submit" disabled={update.isPending}>
          Save details
        </Button>
      </div>
    </form>
  );
}
