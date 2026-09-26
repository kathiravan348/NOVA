import { useState } from "react";
import { KiteKeysUpdateSchema, MIN_PASSPHRASE_LENGTH } from "@nova/contracts";
import { Button, Input, Modal, useToast } from "@nova/ui-core";
import { getDataMode, useSaveKiteKeys } from "@nova/services";

export interface KiteKeysModalProps {
  accountId: string;
  /** Keys are already saved: warn that a new key logs the account out of Kite. */
  hasKeys: boolean;
  open: boolean;
  onClose: () => void;
}

/** Saves the Kite API key and secret; the server seals the secret with the passphrase (D55). */
export function KiteKeysModal({ accountId, hasKeys, open, onClose }: KiteKeysModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Set Kite API key and secret"
      description="Copy both from your app in the Kite developer console. The secret is locked with your passphrase; NOVA never shows it again."
    >
      {open && <KiteKeysForm accountId={accountId} hasKeys={hasKeys} onDone={onClose} />}
    </Modal>
  );
}

type Field = "apiKey" | "apiSecret" | "passphrase" | "confirm";

function KiteKeysForm({
  accountId,
  hasKeys,
  onDone,
}: {
  accountId: string;
  hasKeys: boolean;
  onDone: () => void;
}) {
  const toast = useToast();
  const save = useSaveKiteKeys(accountId);
  const [values, setValues] = useState<Record<Field, string>>({
    apiKey: "",
    apiSecret: "",
    passphrase: "",
    confirm: "",
  });
  const [touched, setTouched] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const parsed = KiteKeysUpdateSchema.safeParse({
    apiKey: values.apiKey.trim(),
    apiSecret: values.apiSecret.trim(),
    passphrase: values.passphrase,
  });
  const mismatch = values.confirm !== values.passphrase;
  const fieldError = (field: Field): string | undefined => {
    if (!touched) return undefined;
    if (field === "confirm") return mismatch ? "The passphrases do not match" : undefined;
    return parsed.success
      ? undefined
      : parsed.error.issues.find((issue) => issue.path[0] === field)?.message;
  };
  const set = (field: Field) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  const submit = async () => {
    if (!parsed.success || mismatch) return;
    setFailed(null);
    try {
      await save.mutateAsync(parsed.data);
      const demo = getDataMode() === "mock";
      toast.show({
        title: demo ? "Kite keys saved (demo)" : "Kite keys saved",
        description: demo
          ? "Mock mode does not store them."
          : "The secret is locked with your passphrase. You need it at every daily login.",
        tone: "success",
      });
      onDone();
    } catch (err) {
      setFailed(err instanceof Error ? err.message : "Could not save the keys");
    } finally {
      save.reset();
      setValues({ apiKey: values.apiKey, apiSecret: "", passphrase: "", confirm: "" });
    }
  };

  const secretProps = { type: "password", autoComplete: "new-password", spellCheck: false };
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
        label="API key"
        autoComplete="off"
        spellCheck={false}
        value={values.apiKey}
        onChange={set("apiKey")}
        error={fieldError("apiKey")}
      />
      <Input
        label="API secret"
        {...secretProps}
        value={values.apiSecret}
        onChange={set("apiSecret")}
        error={fieldError("apiSecret")}
      />
      <Input
        label="Passphrase"
        description={`At least ${MIN_PASSPHRASE_LENGTH} characters. A short sentence is easy to remember.`}
        {...secretProps}
        value={values.passphrase}
        onChange={set("passphrase")}
        error={fieldError("passphrase")}
      />
      <Input
        label="Confirm passphrase"
        {...secretProps}
        value={values.confirm}
        onChange={set("confirm")}
        error={fieldError("confirm")}
      />
      <p className="text-body-sm text-warning-text">
        NOVA cannot recover this passphrase. If you forget it, enter the key and secret again.
      </p>
      {hasKeys && (
        <p className="text-body-sm text-text-secondary">
          Saving a new key logs this account out of Kite.
        </p>
      )}
      {failed && (
        <p role="alert" className="text-body-sm text-loss">
          {failed}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          Save keys
        </Button>
      </div>
    </form>
  );
}
