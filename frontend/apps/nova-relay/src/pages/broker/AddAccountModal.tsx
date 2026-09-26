import { useState } from "react";
import { useNavigate } from "react-router";
import { BrokerAccountCreateSchema } from "@nova/contracts";
import { Button, Input, Modal, useToast } from "@nova/ui-core";
import { getDataMode, useCreateBrokerAccount } from "@nova/services";

export interface AddAccountModalProps {
  open: boolean;
  onClose: () => void;
}

/** Adds a Zerodha account (D52); the daily Kite login is a separate step on the account page. */
export function AddAccountModal({ open, onClose }: AddAccountModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Add broker account"
      description="Add a Zerodha account. After adding it, log in to Kite from the account page."
    >
      {open && <AddAccountForm onDone={onClose} />}
    </Modal>
  );
}

function AddAccountForm({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const create = useCreateBrokerAccount();
  const [label, setLabel] = useState("");
  const [clientId, setClientId] = useState("");
  const [touched, setTouched] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const parsed = BrokerAccountCreateSchema.safeParse({ label, clientId: clientId.trim() });
  const fieldError = (field: "label" | "clientId"): string | undefined =>
    touched && !parsed.success
      ? parsed.error.issues.find((issue) => issue.path[0] === field)?.message
      : undefined;

  const save = async () => {
    if (!parsed.success) return;
    setFailed(null);
    try {
      const account = await create.mutateAsync(parsed.data);
      const demo = getDataMode() === "mock";
      toast.show({
        title: demo ? "Account added (demo)" : "Account added",
        description: demo
          ? "Mock mode does not store it; real mode records this in the audit log."
          : `${account.label} (${account.clientId}). Log in to Kite to start using it.`,
        tone: "success",
      });
      onDone();
      if (!demo) void navigate(`/broker/${account.id}`);
    } catch (err) {
      setFailed(err instanceof Error ? err.message : "Could not add the account");
    }
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        void save();
      }}
    >
      <Input
        label="Account name"
        description="Any name you like, e.g. Main or Family."
        maxLength={60}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        error={fieldError("label")}
      />
      <Input
        label="Zerodha client ID"
        description="Your Zerodha user ID, e.g. AB1234."
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        error={fieldError("clientId")}
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
        <Button type="submit" disabled={create.isPending}>
          Add account
        </Button>
      </div>
    </form>
  );
}
