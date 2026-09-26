import { useState } from "react";
import { KitePassphraseSchema } from "@nova/contracts";
import { Button, Input } from "@nova/ui-core";

export interface PassphraseFormProps {
  submitLabel: string;
  /** Resolves on success; a thrown error's message is shown under the field. */
  onSubmit: (passphrase: string) => Promise<void>;
  onCancel: () => void;
}

/**
 * One passphrase field (D55). The value lives only in this form's state: it is cleared after
 * every attempt and disappears when the dialog closes.
 */
export function PassphraseForm({ submitLabel, onSubmit, onCancel }: PassphraseFormProps) {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const parsed = KitePassphraseSchema.safeParse({ passphrase });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter your passphrase");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(parsed.data.passphrase);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPassphrase("");
      setBusy(false);
    }
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Input
        label="Passphrase"
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        error={error ?? undefined}
      />
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
